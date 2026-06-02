import * as XLSX from 'xlsx'

export function buildXlsx(
  sheets: Array<{ name: string; rows: Record<string, unknown>[] }>,
): ArrayBuffer {
  const wb = XLSX.utils.book_new()

  for (const { name, rows } of sheets) {
    const ws = XLSX.utils.json_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, name)
  }

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as ArrayBuffer
}

export function xlsxResponse(buffer: ArrayBuffer, filename: string): Response {
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
