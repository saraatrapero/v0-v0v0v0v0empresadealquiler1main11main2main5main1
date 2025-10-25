import { type NextRequest, NextResponse } from "next/server"
import { articulosDB } from "@/lib/database"
import { ArticuloSchema, validateOrThrow } from "@/lib/validations/schemas"

export async function GET() {
  try {
    const articulos = await articulosDB.getAll()
    return NextResponse.json({ success: true, data: articulos })
  } catch (error) {
    console.error("Error fetching articulos:", error)
    return NextResponse.json({ success: false, error: "Error al obtener artículos" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validación con Zod
    try {
      const data = validateOrThrow(ArticuloSchema, body)
      const articulo = await articulosDB.create(data)
      return NextResponse.json({ success: true, data: articulo }, { status: 201 })
    } catch (validationError: any) {
      return NextResponse.json({ success: false, error: validationError.message || "Datos inválidos", details: validationError.details }, { status: 400 })
    }
  } catch (error) {
    console.error("Error creating articulo:", error)
    return NextResponse.json({ success: false, error: "Error al crear artículo" }, { status: 500 })
  }
}
