import { type NextRequest, NextResponse } from "next/server"
import { usuariosDB } from "@/lib/database"
import { UsuarioSchema, validateOrThrow } from "@/lib/validations/schemas"

export async function GET() {
  try {
    const usuarios = await usuariosDB.getAll()
    return NextResponse.json({ success: true, data: usuarios })
  } catch (error) {
    console.error("Error fetching usuarios:", error)
    return NextResponse.json({ success: false, error: "Error al obtener usuarios" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    try {
      const data = validateOrThrow(UsuarioSchema, body)
      const usuario = await usuariosDB.create(data)
      return NextResponse.json({ success: true, data: usuario }, { status: 201 })
    } catch (validationError: any) {
      return NextResponse.json({ success: false, error: validationError.message || "Datos inválidos", details: validationError.details }, { status: 400 })
    }
  } catch (error) {
    console.error("Error creating usuario:", error)
    return NextResponse.json({ success: false, error: "Error al crear usuario" }, { status: 500 })
  }
}
