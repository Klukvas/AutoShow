// Test support for theme-folders.test.ts: what a source file loads, names and declares,
// read from its syntax tree. Never imported by app code, so it is in no bundle.
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// With parent links: what an identifier is (a name or a read) depends on where it stands.
const parse = (file: string) =>
  ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);

/** What `pick` finds on each node of a file, in source order. */
function collect<T>(file: string, pick: (node: ts.Node) => readonly T[]): T[] {
  const found: T[] = [];
  const visit = (node: ts.Node) => {
    found.push(...pick(node));
    ts.forEachChild(node, visit);
  };
  visit(parse(file));
  return found;
}

/** `(x)`, `x as T`, `<T>x`, `x!`, `x satisfies T` → `x`: wrappers that leave the value as it is. */
function unwrapped(expression: ts.Expression): ts.Expression {
  const isWrapper =
    ts.isParenthesizedExpression(expression) ||
    ts.isAsExpression(expression) ||
    ts.isTypeAssertionExpression(expression) ||
    ts.isNonNullExpression(expression) ||
    ts.isSatisfiesExpression(expression);
  return isWrapper ? unwrapped(expression.expression) : expression;
}

/** The module argument of `import(…)` / `require(…)`, or undefined for any other node. */
function loadedModuleArgument(node: ts.Node): ts.Expression | undefined {
  if (!ts.isCallExpression(node)) return undefined;
  const isLoader =
    node.expression.kind === ts.SyntaxKind.ImportKeyword ||
    (ts.isIdentifier(node.expression) && node.expression.text === 'require');
  return isLoader && node.arguments.length > 0 ? unwrapped(node.arguments[0]) : undefined;
}

type CalledMember = Readonly<{ owner: ts.Expression; name: string }>;

/** The member a call is made on — `owner.name(…)` or `owner['name'](…)` — wrappers aside. */
function calledMember(call: ts.CallExpression): CalledMember | undefined {
  const callee = unwrapped(call.expression);
  if (ts.isPropertyAccessExpression(callee)) {
    return { owner: unwrapped(callee.expression), name: callee.name.text };
  }
  if (!ts.isElementAccessExpression(callee)) return undefined;
  const key = unwrapped(callee.argumentExpression);
  return ts.isStringLiteralLike(key)
    ? { owner: unwrapped(callee.expression), name: key.text }
    : undefined;
}

/**
 * The directory argument of `require.context(…)` / `import.meta.webpackContext(…)`.
 * Neither is typed in this project, so the plain spelling does not compile and real
 * code has to cast its way there — `(require as any).context(…)` — or quote the member
 * under a suppressed error: `require['context'](…)`. A loader reached through a variable
 * (`const load = require; load.context(…)`) is not followed.
 */
function contextDirectoryArgument(node: ts.Node): ts.Expression | undefined {
  if (!ts.isCallExpression(node)) return undefined;
  const member = calledMember(node);
  if (!member) return undefined;
  const { owner, name } = member;
  const isContextLoader =
    (ts.isIdentifier(owner) && owner.text === 'require' && name === 'context') ||
    (ts.isMetaProperty(owner) && name === 'webpackContext');
  return isContextLoader ? node.arguments[0] : undefined;
}

/** An import whose bindings are all types is erased by the compiler: it loads nothing. */
function isErasedImport(clause: ts.ImportClause | undefined): boolean {
  if (!clause) return false;
  if (clause.isTypeOnly) return true;
  const named =
    clause.namedBindings && ts.isNamedImports(clause.namedBindings)
      ? clause.namedBindings.elements
      : [];
  return !clause.name && named.length > 0 && named.every((element) => element.isTypeOnly);
}

export type ModuleImport = Readonly<{
  specifier: string;
  isTypeOnly: boolean;
  /** An `import … from` / `export … from` statement, evaluated whenever the file is. */
  isStatic: boolean;
}>;

/** The module a node loads by a literal name, if it is an import of any kind. */
function importOn(node: ts.Node): ModuleImport[] {
  if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
    const isTypeOnly = isErasedImport(node.importClause);
    return [{ specifier: node.moduleSpecifier.text, isTypeOnly, isStatic: true }];
  }
  if (
    ts.isExportDeclaration(node) &&
    node.moduleSpecifier &&
    ts.isStringLiteral(node.moduleSpecifier)
  ) {
    return [{ specifier: node.moduleSpecifier.text, isTypeOnly: node.isTypeOnly, isStatic: true }];
  }
  const loaded = loadedModuleArgument(node);
  return loaded && ts.isStringLiteralLike(loaded)
    ? [{ specifier: loaded.text, isTypeOnly: false, isStatic: false }]
    : [];
}

/** Every module a file loads by a literal name (static, re-export, side-effect, dynamic, require). */
export function importsOf(file: string): ModuleImport[] {
  return collect(file, importOn);
}

/**
 * Every literal text a computed specifier may start with: the head of `@theme/${x}`,
 * the left side of '@theme/' + x, and each alternative of `a ? b : c`, `a || b`, `a ?? b`.
 */
function specifierStarts(expression: ts.Expression): string[] {
  const value = unwrapped(expression);
  if (ts.isStringLiteralLike(value)) return [value.text];
  if (ts.isTemplateExpression(value)) return [value.head.text];
  if (ts.isConditionalExpression(value)) {
    return [...specifierStarts(value.whenTrue), ...specifierStarts(value.whenFalse)];
  }
  if (!ts.isBinaryExpression(value)) return [];
  return value.operatorToken.kind === ts.SyntaxKind.PlusToken
    ? specifierStarts(value.left)
    : [...specifierStarts(value.left), ...specifierStarts(value.right)];
}

/** Literal starts of the `import()` / `require()` calls whose module is computed at run time. */
export function computedImportStartsOf(file: string): string[] {
  return collect(file, (node) => {
    const loaded = loadedModuleArgument(node);
    return loaded && !ts.isStringLiteralLike(loaded) ? specifierStarts(loaded) : [];
  });
}

/** Directories (their literal starts) a file bundles wholesale through a webpack context. */
export function contextDirectoriesOf(file: string): string[] {
  return collect(file, (node) => {
    const directory = contextDirectoryArgument(node);
    return directory ? specifierStarts(directory) : [];
  });
}

const GLOBAL_OBJECTS = new Set(['globalThis', 'window', 'self']);

/**
 * Uses the global `fetch` — the one way to load data without importing anything.
 * Any identifier named `fetch` counts (called, aliased, passed on), as do
 * `globalThis|window|self` `.fetch` / `['fetch']`; a view has no other use for the name.
 */
export function usesFetch(file: string): boolean {
  // `window`, and chains such as `globalThis.window`.
  const isGlobalObject = (node: ts.Expression): boolean =>
    ts.isPropertyAccessExpression(node)
      ? GLOBAL_OBJECTS.has(node.name.text) && isGlobalObject(node.expression)
      : ts.isIdentifier(node) && GLOBAL_OBJECTS.has(node.text);
  const visit = (node: ts.Node): boolean => {
    if (ts.isPropertyAccessExpression(node)) {
      if (node.name.text === 'fetch' && isGlobalObject(node.expression)) return true;
      // `api.fetch` is a method of something imported, which the import guard covers.
      return visit(node.expression);
    }
    if (
      ts.isElementAccessExpression(node) &&
      isGlobalObject(node.expression) &&
      ts.isStringLiteralLike(node.argumentExpression) &&
      node.argumentExpression.text === 'fetch'
    ) {
      return true;
    }
    if (ts.isIdentifier(node) && node.text === 'fetch') return true;
    return ts.forEachChild(node, visit) ?? false;
  };
  return visit(parse(file));
}

/** Whether code (not a comment) names `name`: an identifier, a property or a quoted key. */
export function namesInCode(file: string, name: string): boolean {
  const visit = (node: ts.Node): boolean =>
    ((ts.isIdentifier(node) || ts.isStringLiteralLike(node)) && node.text === name) ||
    (ts.forEachChild(node, visit) ?? false);
  return visit(parse(file));
}

/** Types are erased by the compiler: a name inside one is no read of the value. */
const isTypeOnlySyntax = (node: ts.Node) =>
  ts.isTypeNode(node) || ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node);

/**
 * `x.name`, `{ name: … }`, `<a name=… />`, `const name = …`: the identifier is the name
 * its parent gives to something, not a read of a binding. In `{ name }` it is both.
 */
function isOwnNameOfParent(identifier: ts.Identifier): boolean {
  const { parent } = identifier;
  return (
    !ts.isShorthandPropertyAssignment(parent) && 'name' in parent && parent.name === identifier
  );
}

/**
 * Whether code reads the binding `name` as a value. That is what keeps an import of it
 * in the compiled module: an import nothing reads is dropped, and its module is then not
 * evaluated through this file. Import and export lists, types and names of members or
 * declarations do not count. Scopes are not resolved: a local that re-declares `name`
 * is taken for the same binding.
 */
export function readsAsValue(file: string, name: string): boolean {
  const visit = (node: ts.Node): boolean => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node) || isTypeOnlySyntax(node)) {
      return false;
    }
    if (ts.isIdentifier(node) && node.text === name && !isOwnNameOfParent(node)) return true;
    return ts.forEachChild(node, visit) ?? false;
  };
  return visit(parse(file));
}

const directiveOf = (statement: ts.Statement) =>
  ts.isExpressionStatement(statement) && ts.isStringLiteral(statement.expression)
    ? statement.expression.text
    : undefined;

/** Whether the file opens with the `'use client'` directive, i.e. is a client module. */
export function isClientModule(file: string): boolean {
  const leading = parse(file).statements.map(directiveOf);
  const prologueEnd = leading.indexOf(undefined);
  return leading.slice(0, prologueEnd === -1 ? leading.length : prologueEnd).includes('use client');
}

export type ForwardedExport = Readonly<{ specifier: string; name: string }>;

const isExported = (statement: ts.VariableStatement) =>
  statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ?? false;

/** Local bindings a file exports under `exportName`: `export { a as X }`, `export const X = a`. */
function localNamesExportedAs(source: ts.SourceFile, exportName: string): string[] {
  return source.statements.flatMap((statement) => {
    if (ts.isVariableStatement(statement) && isExported(statement)) {
      return statement.declarationList.declarations.flatMap((declaration) =>
        ts.isIdentifier(declaration.name) &&
        declaration.name.text === exportName &&
        declaration.initializer &&
        ts.isIdentifier(declaration.initializer)
          ? [declaration.initializer.text]
          : [],
      );
    }
    const isLocalExportList =
      ts.isExportDeclaration(statement) &&
      !statement.moduleSpecifier &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause);
    if (!isLocalExportList) return [];
    return statement.exportClause.elements
      .filter((element) => element.name.text === exportName)
      .map((element) => element.propertyName?.text ?? exportName);
  });
}

/** `export { a as X } from 'm'` and `export * from 'm'`: X comes from module m. */
function reExportsOf(statement: ts.Statement, exportName: string): ForwardedExport[] {
  if (
    !ts.isExportDeclaration(statement) ||
    !statement.moduleSpecifier ||
    !ts.isStringLiteral(statement.moduleSpecifier)
  ) {
    return [];
  }
  const specifier = statement.moduleSpecifier.text;
  if (!statement.exportClause) return [{ specifier, name: exportName }];
  if (!ts.isNamedExports(statement.exportClause)) return [];
  return statement.exportClause.elements
    .filter((element) => element.name.text === exportName)
    .map((element) => ({ specifier, name: element.propertyName?.text ?? exportName }));
}

/** `import a, { b as c } from 'm'` for the local names asked about. */
function importedBindingsOf(statement: ts.Statement, localNames: string[]): ForwardedExport[] {
  if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
    return [];
  }
  const specifier = statement.moduleSpecifier.text;
  const clause = statement.importClause;
  const named =
    clause?.namedBindings && ts.isNamedImports(clause.namedBindings)
      ? clause.namedBindings.elements
      : [];
  return [
    ...(clause?.name && localNames.includes(clause.name.text)
      ? [{ specifier, name: 'default' }]
      : []),
    ...named
      .filter((element) => localNames.includes(element.name.text))
      .map((element) => ({ specifier, name: element.propertyName?.text ?? element.name.text })),
  ];
}

/**
 * The modules a file takes its export `exportName` from instead of declaring it: a
 * re-export, `export *`, or an imported binding exported again (also under a new name).
 */
export function forwardedExportsOf(file: string, exportName: string): ForwardedExport[] {
  const source = parse(file);
  const localNames = localNamesExportedAs(source, exportName);
  return source.statements.flatMap((statement) => [
    ...reExportsOf(statement, exportName),
    ...importedBindingsOf(statement, localNames),
  ]);
}
