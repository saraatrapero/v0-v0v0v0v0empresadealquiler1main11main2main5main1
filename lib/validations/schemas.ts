import { z } from "zod"

export const ArticuloSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  descripcion: z.string().optional(),
  precio: z.number().finite().nonnegative().optional(),
})

export const PedidoArticuloSchema = z.object({
  articulo_id: z.string().min(1),
  cantidad: z.number().int().positive(),
  precio: z.number().finite().nonnegative().optional(),
})

export const PedidoSchema = z.object({
  cliente_id: z.string().min(1, "El cliente es requerido"),
  articulos: z.array(PedidoArticuloSchema).min(1, "El pedido debe contener al menos un artículo"),
  fecha_pedido: z.string().optional(),
})

export const UsuarioSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  email: z.string().email("Email inválido"),
})

export const ProveedorSchema = z.object({
  nombre: z.string().min(1, "El nombre del proveedor es requerido"),
  email: z.string().email("Email inválido").optional(),
  telefono: z.string().optional(),
  direccion: z.string().optional(),
  cif: z.string().optional(),
})

export function validateOrThrow<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data)
  if (!result.success) {
    // Lanzar un error con detalles minimalistas para serializar en la API
    const message = result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ")
    const error: any = new Error(message)
    error.details = result.error.errors
    throw error
  }
  return result.data
}

export type Articulo = z.infer<typeof ArticuloSchema>
export type Pedido = z.infer<typeof PedidoSchema>
export type Usuario = z.infer<typeof UsuarioSchema>
