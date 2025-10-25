import { type NextRequest, NextResponse } from "next/server"
import { pedidosDB } from "@/lib/database"
import { PedidoSchema, validateOrThrow } from "@/lib/validations/schemas"

export async function GET() {
  try {
    const pedidos = await pedidosDB.getAll()
    return NextResponse.json({ success: true, data: pedidos })
  } catch (error) {
    console.error("Error fetching pedidos:", error)
    return NextResponse.json({ success: false, error: "Error al obtener pedidos" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    try {
      const data = validateOrThrow(PedidoSchema, body)
      const pedido = await pedidosDB.create(data)
      return NextResponse.json({ success: true, data: pedido }, { status: 201 })
    } catch (validationError: any) {
      return NextResponse.json({ success: false, error: validationError.message || "Datos inválidos", details: validationError.details }, { status: 400 })
    }
  } catch (error) {
    console.error("Error creating pedido:", error)
    return NextResponse.json({ success: false, error: "Error al crear pedido" }, { status: 500 })
  }
}
