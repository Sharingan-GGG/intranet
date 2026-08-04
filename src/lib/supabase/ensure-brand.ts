import { getBrandByCode, setBrand } from "@/lib/sqlite/cache"

/**
 * Resolve or create a row in `brands` by canonical code (sheet / scan brand string).
 */
export async function ensureBrandId(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  code: string
): Promise<number> {
  const c = code.trim()
  if (!c) throw new Error("brand code is required")

  const cached = getBrandByCode(c)
  if (cached !== null) return cached

  const { data, error } = await db
    .from("brands")
    .upsert({ code: c }, { onConflict: "code" })
    .select("id")
    .single()

  if (error) throw new Error(`ensureBrandId: ${error.message}`)
  const id = data?.id as number | undefined
  if (id == null || typeof id !== "number") {
    throw new Error("ensureBrandId: missing brand id")
  }

  setBrand(id, c)
  return id
}
