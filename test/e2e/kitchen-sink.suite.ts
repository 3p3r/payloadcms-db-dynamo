import { test, expect } from '@playwright/test'

import { authStatePath } from './auth-path.js'
import { COLLECTIONS, GLOBALS, MAX_MS } from './constants.js'
import {
  fillField,
  fillPoint,
  fillTextarea,
  gotoCollectionList,
  gotoCreate,
  gotoGlobal,
  registerFirstAdminUser,
  saveDocument,
  searchCollectionList,
  selectRelationshipOption,
  selectBlockInDrawer,
  switchLocale,
  uploadMedia,
  expectVisible,
} from './helpers.js'

export function registerKitchenSinkSuite(projectName: 'payload-3' | 'payload-4'): void {
  const label = projectName === 'payload-3' ? 'Payload 3.x' : 'Payload 4.x'
  const nodeMajor = Number(process.versions.node.split('.')[0] ?? 0)

  test.skip(
    projectName === 'payload-4' && nodeMajor < 24,
    'Payload 4.x example requires Node.js >= 24 (see examples/payload-4.x/package.json)',
  )

  test.describe.configure({ mode: 'serial', timeout: MAX_MS })
  test.use({ storageState: authStatePath(projectName) })

  test.describe(`Kitchen sink (${label})`, () => {
    const id = Date.now()
    const accountEmail = `acct-${id}@example.com`
    const authorName = `Author ${id}`
    const tagLabel = `Tag ${id}`
    const categoryName = `Category ${id}`
    const postTitle = `Post ${id}`
    const placeName = `Place ${id}`
    const pageTitleEn = `Page EN ${id}`
    const pageTitleFr = `Page FR ${id}`
    const docTitle = `Doc ${id}`
    const articleTitle = `Article ${id}`
    const siteName = `Site ${id}`
    const mediaAlt = `Media ${id}`

    test('accounts — unique email', async ({ page }) => {
      await gotoCreate(page, COLLECTIONS.accounts)
      await fillField(page, /email/i, accountEmail)
      await saveDocument(page)
      await expectVisible(page, accountEmail)
    })

    test('authors', async ({ page }) => {
      await gotoCreate(page, COLLECTIONS.authors)
      await fillField(page, /name/i, authorName)
      await saveDocument(page)
      await expectVisible(page, authorName)
    })

    test('tags', async ({ page }) => {
      await gotoCreate(page, COLLECTIONS.tags)
      await fillField(page, /label/i, tagLabel)
      await saveDocument(page)
      await expectVisible(page, tagLabel)
    })

    test('categories', async ({ page }) => {
      await gotoCreate(page, COLLECTIONS.categories)
      await fillField(page, /name/i, categoryName)
      await saveDocument(page)
      await expectVisible(page, categoryName)
    })

    test('posts — drafts, relationships, geo, search fields', async ({ page }) => {
      await gotoCreate(page, COLLECTIONS.posts)
      await fillField(page, /title/i, postTitle)
      await fillTextarea(page, /body/i, `Body for ${postTitle}`)
      await fillPoint(page, /location/i, 40.7128, -74.006)
      await selectRelationshipOption(page, /author/i, authorName)
      await selectRelationshipOption(page, /category/i, categoryName)
      await selectRelationshipOption(page, /^tags$/i, tagLabel)
      await selectRelationshipOption(page, /related/i, authorName)
      await saveDocument(page)
      await expectVisible(page, postTitle)
    })

    test('posts — admin list search', async ({ page }) => {
      await gotoCollectionList(page, COLLECTIONS.posts)
      await searchCollectionList(page, postTitle)
      await expectVisible(page, postTitle)
    })

    test('categories — join field shows linked post', async ({ page }) => {
      await gotoCollectionList(page, COLLECTIONS.categories)
      await page.getByRole('link', { name: categoryName }).first().click({ timeout: MAX_MS })
      await expect(page.getByText(postTitle).first()).toBeVisible({ timeout: MAX_MS })
    })

    test('places — geo point', async ({ page }) => {
      await gotoCreate(page, COLLECTIONS.places)
      await fillField(page, /name/i, placeName)
      await fillPoint(page, /location/i, 34.0522, -118.2437)
      await saveDocument(page)
      await expectVisible(page, placeName)
    })

    test('pages — localized title', async ({ page }) => {
      await gotoCreate(page, COLLECTIONS.pages)
      await fillField(page, /title/i, pageTitleEn)
      await switchLocale(page, 'fr')
      await fillField(page, /title/i, pageTitleFr)
      await saveDocument(page)
      await gotoCollectionList(page, COLLECTIONS.pages)
      await expect(
        page.getByText(pageTitleEn).or(page.getByText(pageTitleFr)).first(),
      ).toBeVisible({ timeout: MAX_MS })
    })

    test('docs — group, array, blocks', async ({ page }) => {
      await gotoCreate(page, COLLECTIONS.docs)
      await fillField(page, /^title$/i, docTitle)
      await fillField(page, /author/i, 'Doc Author')
      await page.getByRole('button', { name: /add tag/i }).click({ timeout: MAX_MS })
      await fillField(page, /label/i, 'doc-tag')
      await page.getByRole('button', { name: /add section/i }).click({ timeout: MAX_MS })
      await selectBlockInDrawer(page, /^text$/i)
      await fillTextarea(page, /body/i, 'Block body')
      await saveDocument(page)
      await expectVisible(page, docTitle)
    })

    test('articles — draft then publish', async ({ page }) => {
      await gotoCreate(page, COLLECTIONS.articles)
      await fillField(page, /title/i, articleTitle)
      await saveDocument(page, { draft: true })
      await page.getByRole('button', { name: /publish changes/i }).first().click({ timeout: MAX_MS })
      await expectVisible(page, articleTitle)
    })

    test('globals — site, settings, versioned header', async ({ page }) => {
      await gotoGlobal(page, GLOBALS.site)
      await fillField(page, /siteName|site name/i, siteName)
      await saveDocument(page)
      await expect(page.getByRole('textbox', { name: /site name/i })).toHaveValue(siteName, {
        timeout: MAX_MS,
      })

      await gotoGlobal(page, GLOBALS.settings)
      await fillField(page, /siteName|site name/i, `${siteName} Settings`)
      await saveDocument(page)

      await gotoGlobal(page, GLOBALS.header)
      const logoValue = `Logo ${id}`
      await fillField(page, /logoText|logo/i, logoValue)
      await saveDocument(page)
      await expect(page.getByRole('textbox', { name: /logo/i })).toHaveValue(logoValue, {
        timeout: MAX_MS,
      })
    })

    test('media — upload', async ({ page }) => {
      await uploadMedia(page, mediaAlt)
    })
  })
}
