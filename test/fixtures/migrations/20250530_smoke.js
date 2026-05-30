export async function up({ payload }) {
  await payload.create({
    collection: 'items',
    data: { label: 'migrated' },
  })
}

export async function down({ payload }) {
  const rows = await payload.find({ collection: 'items', limit: 100, pagination: false })
  await Promise.all(
    rows.docs.map((doc) => payload.delete({ collection: 'items', id: doc.id })),
  )
}
