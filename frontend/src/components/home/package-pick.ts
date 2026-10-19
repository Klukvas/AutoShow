/*
 * Shared by the tariff cards (client), the sell form (client) and the sell
 * section (server). Kept out of the 'use client' modules: a server component
 * importing a value from one gets a client reference, not the string.
 */

/** Custom event carrying the picked placement package id to the sell form. */
export const PACKAGE_PICK_EVENT = 'af:placement-package';

/**
 * DOM id of the sell form a pick scrolls to — the form itself, not the #sell
 * section: on phones the section opens with the consignment copy and the
 * preselected tariff would sit below the fold.
 */
export const SELL_FORM_ID = 'sell-form';
