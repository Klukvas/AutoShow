import { isAiAccessPermitted } from './ai-access.policy';

const editor = { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', role: 'editor' };
const other = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

describe('isAiAccessPermitted', () => {
  it('always lets an admin in and never an unknown actor', () => {
    expect(isAiAccessPermitted({ id: 'a', role: 'admin' }, null)).toBe(true);
    expect(isAiAccessPermitted(null, { accessMode: 'all', selectedEditorIds: [] })).toBe(false);
  });

  it('applies the owner policy to editors', () => {
    expect(isAiAccessPermitted(editor, { accessMode: 'all', selectedEditorIds: [] })).toBe(true);
    expect(isAiAccessPermitted(editor, { accessMode: 'admins', selectedEditorIds: [] })).toBe(
      false,
    );
    expect(
      isAiAccessPermitted(editor, { accessMode: 'selected', selectedEditorIds: [editor.id] }),
    ).toBe(true);
    expect(
      isAiAccessPermitted(editor, { accessMode: 'selected', selectedEditorIds: [other] }),
    ).toBe(false);
  });

  it('denies editors when the stored policy is malformed', () => {
    for (const policy of [
      { accessMode: 'everyone', selectedEditorIds: [] },
      { accessMode: 'selected', selectedEditorIds: 'x' },
      { accessMode: 'selected', selectedEditorIds: [editor.id, editor.id] },
      { accessMode: 'selected', selectedEditorIds: ['not-a-uuid'] },
      { accessMode: 'selected', selectedEditorIds: Array.from({ length: 201 }, () => editor.id) },
    ])
      expect(isAiAccessPermitted(editor, policy)).toBe(false);
    expect(isAiAccessPermitted(editor, null)).toBe(false);
  });
});
