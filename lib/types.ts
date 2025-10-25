export interface Articulo {
  id: string
  nombre: string
  codigo?: string
  categoria?: string
  descripcion?: string
  imagenes?: string[]
  precio_dia?: number
  stock_disponible?: number
  stock_total?: number
}

export interface PedidoArticulo {
  articulo_id: string
  cantidad: number
  precio_unitario?: number
  nombre?: string
}

export interface Pedido {
  id: string
  cliente_id: string
  numeroPedido?: string
  fecha_pedido?: string
  fecha_entrega?: string
  fecha_devolucion?: string
  articulos?: PedidoArticulo[]
  total?: number
}

export interface Cliente {
  id: string
  nombre: string
  email: string
}
