import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { ACTION_MS, MAX_MS } from './constants.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const DEFAULT_PASSWORD = 'E2eTestPassword123!'
export const TINY_PNG = path.join(__dirname, 'fixtures', 'tiny.png')

export async function registerFirstAdminUser(page: Page, email: string): Promise<void> {
  await page.goto('/admin/create-first-user', { timeout: ACTION_MS })
  await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible({ timeout: MAX_MS })

  await page.getByRole('textbox', { name: /email/i }).fill(email)
  await page.getByRole('textbox', { name: /new password/i }).fill(DEFAULT_PASSWORD)
  await page.getByRole('textbox', { name: /confirm password/i }).fill(DEFAULT_PASSWORD)
  await page.getByRole('button', { name: /^create$/i }).click()

  await expect(page).not.toHaveURL(/create-first-user/, { timeout: MAX_MS })
  await expect(page.locator('#nav-posts')).toBeVisible({ timeout: MAX_MS })
}

export async function gotoCreate(page: Page, collection: string): Promise<void> {
  await page.goto(`/admin/collections/${collection}/create`, { timeout: ACTION_MS })
}

export async function gotoEdit(page: Page, collection: string, id: string): Promise<void> {
  await page.goto(`/admin/collections/${collection}/${id}`, { timeout: ACTION_MS })
}

export async function gotoCollectionList(page: Page, collection: string): Promise<void> {
  await page.goto(`/admin/collections/${collection}`, { timeout: ACTION_MS })
}

export async function gotoGlobal(page: Page, slug: string): Promise<void> {
  await page.goto(`/admin/globals/${slug}`, { timeout: ACTION_MS })
}

export async function fillField(page: Page, label: RegExp | string, value: string): Promise<void> {
  const textbox = page.getByRole('textbox', { name: label })
  if ((await textbox.count()) > 0) {
    await textbox.first().fill(value, { timeout: ACTION_MS })
    return
  }
  await page.getByLabel(label).first().fill(value, { timeout: ACTION_MS })
}

export async function fillTextarea(page: Page, label: RegExp | string, value: string): Promise<void> {
  const byRole = page.getByRole('textbox', { name: label })
  if ((await byRole.count()) > 0) {
    await byRole.first().fill(value, { timeout: ACTION_MS })
    return
  }
  const field = page.locator('.field-type.textarea, .field-type.richText').filter({
    has: page.getByText(label, { exact: false }),
  })
  const textarea = field.locator('textarea')
  if ((await textarea.count()) > 0) {
    await textarea.first().fill(value, { timeout: ACTION_MS })
  }
}

export async function fillPoint(page: Page, _label: RegExp, lat: number, lng: number): Promise<void> {
  const field = page.locator('.field-type.point').first()
  const spinners = field.getByRole('spinbutton')
  if ((await spinners.count()) >= 2) {
    await spinners.nth(0).fill(String(lat), { timeout: ACTION_MS })
    await spinners.nth(1).fill(String(lng), { timeout: ACTION_MS })
    return
  }
  const inputs = field.locator('input[type="number"], input:not([type="hidden"])')
  if ((await inputs.count()) >= 2) {
    await inputs.nth(0).fill(String(lat), { timeout: ACTION_MS })
    await inputs.nth(1).fill(String(lng), { timeout: ACTION_MS })
  }
}

export async function saveDocument(page: Page, options?: { draft?: boolean }): Promise<void> {
  if (options?.draft) {
    await page.getByRole('button', { name: /save draft/i }).first().click({ timeout: ACTION_MS })
    return
  }
  const publish = page.getByRole('button', { name: /publish changes/i })
  if ((await publish.count()) > 0) {
    await publish.first().click({ timeout: ACTION_MS })
    return
  }
  await page
    .getByRole('button', { name: /^save$|^create$|^save changes$/i })
    .first()
    .click({ timeout: ACTION_MS })
}

export async function expectVisible(page: Page, text: string): Promise<void> {
  await expect(page.getByText(text).first()).toBeVisible({ timeout: MAX_MS })
}

export async function selectRelationshipOption(
  page: Page,
  fieldName: RegExp | string,
  optionLabel: string,
): Promise<void> {
  const field = page.locator('.field-type.relationship').filter({
    has: page.getByText(fieldName, { exact: false }),
  })
  const combo = field.getByRole('combobox').first()
  if ((await combo.count()) > 0) {
    await combo.click({ timeout: ACTION_MS })
    await page.getByRole('option', { name: optionLabel }).click({ timeout: ACTION_MS })
    return
  }
  await page.getByLabel(fieldName).first().click({ timeout: ACTION_MS })
  await page.getByRole('option', { name: optionLabel }).click({ timeout: ACTION_MS })
}

export async function switchLocale(page: Page, locale: 'en' | 'fr'): Promise<void> {
  const pill = page.getByRole('button', { name: new RegExp(`^${locale}$`, 'i') })
  if (await pill.isVisible()) {
    await pill.click({ timeout: ACTION_MS })
    await expect(page.getByText(new RegExp(`— ${locale}`, 'i')).first()).toBeVisible({ timeout: MAX_MS })
    return
  }

  await page.getByRole('button', { name: /locale/i }).click({ timeout: ACTION_MS })
  const popupOption = page
    .locator('.popup')
    .getByRole('button', { name: new RegExp(`^${locale}$`, 'i') })
  if ((await popupOption.count()) > 0) {
    await popupOption.first().click({ timeout: ACTION_MS })
  } else {
    await page.locator(`[data-locale="${locale}"]`).click({ timeout: ACTION_MS })
  }
  await expect(page.getByText(new RegExp(`— ${locale}`, 'i')).first()).toBeVisible({ timeout: MAX_MS })
}

/** Pick a block type in the open blocks drawer (Payload 3) or dialog (Payload 4). */
export async function selectBlockInDrawer(page: Page, blockLabel: RegExp | string): Promise<void> {
  const name = blockLabel instanceof RegExp ? blockLabel : new RegExp(`^${blockLabel}$`, 'i')
  const panel = page
    .locator('.blocks-drawer')
    .or(page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: /add section/i }) }))
  await expect(panel.first()).toBeVisible({ timeout: MAX_MS })
  await panel.first().getByRole('button', { name }).click({ timeout: ACTION_MS })
  const insert = panel.first().getByRole('button', { name: /^insert$/i })
  if ((await insert.count()) > 0) {
    await expect(insert).toBeEnabled({ timeout: MAX_MS })
    await insert.click({ timeout: ACTION_MS })
  }
}

export async function uploadMedia(page: Page, alt: string): Promise<void> {
  await gotoCreate(page, 'media')
  await page.locator('input[type="file"]').setInputFiles(TINY_PNG, { timeout: ACTION_MS })
  await page.getByRole('textbox', { name: /alt/i }).fill(alt, { timeout: ACTION_MS })
  const save = page.getByRole('button', { name: /^save$/i })
  await expect(save).toBeEnabled({ timeout: MAX_MS })
  await save.click({ timeout: ACTION_MS })
  await gotoCollectionList(page, 'media')
  await expect(page.getByText(alt).first()).toBeVisible({ timeout: MAX_MS })
}

export async function searchCollectionList(page: Page, query: string): Promise<void> {
  const search = page.getByRole('searchbox').or(page.getByPlaceholder(/search/i))
  await search.first().fill(query, { timeout: ACTION_MS })
  await page.keyboard.press('Enter')
}
