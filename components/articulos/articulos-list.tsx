"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { MoreHorizontal, Edit, Trash2, Copy, Eye } from "lucide-react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { getArticulos, deleteArticulo } from "@/app/actions/articulos-actions"
import type { Articulo as ArticuloType } from "@/lib/types"

interface ArticulosListProps {
  searchQuery?: string
}

interface ArticuloAccionesProps {
  articulo: Articulo
  onEliminar: (id: string) => void
  onDuplicar: (articulo: Articulo) => void
}

function ArticuloAcciones({ articulo, onEliminar, onDuplicar }: ArticuloAccionesProps) {
  const router = useRouter()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="sm" className="h-8 w-8 p-0">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => router.push(`/articulos/${articulo.id}`)}>
          <Eye className="mr-2 h-4 w-4" />
          Ver detalles
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push(`/articulos/${articulo.id}/editar`)}>
          <Edit className="mr-2 h-4 w-4" />
          Editar
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onDuplicar(articulo)}>
          <Copy className="mr-2 h-4 w-4" />
          Duplicar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive" onClick={() => onEliminar(articulo.id)}>
          <Trash2 className="mr-2 h-4 w-4" />
          Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const getImageUrl = (articulo: Articulo, width: number, height: number) => {
  if (articulo.imagenes?.[0]) {
    return articulo.imagenes[0]
  }
  // Usar un servicio como placeholder.com para imágenes de marcador de posición más limpias
  return `https://via.placeholder.com/${width}x${height}.png?text=${encodeURIComponent(articulo.nombre)}`
}

export function ArticulosList({ searchQuery = "" }: ArticulosListProps) {
  const router = useRouter()
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [articulos, setArticulos] = useState<Articulo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const cargarArticulos = async () => {
      setLoading(true)
      const result = await getArticulos()
      if (result.success) {
        setArticulos(result.data)
      }
      setLoading(false)
    }
    cargarArticulos()
  }, [])

  const handleEliminar = useCallback(async (id: string) => {
    if (confirm("¿Está seguro de eliminar este artículo?")) {
      const result = await deleteArticulo(id)
      if (result.success) {
        setArticulos((prev) => prev.filter((a) => a.id !== id))
      }
    }
  }, [])

  const handleDuplicar = useCallback((articulo: Articulo) => {
    const params = new URLSearchParams({
      codigo: `${articulo.codigo}-COPIA`,
      nombre: `${articulo.nombre} (Copia)`,
      categoria: articulo.categoria,
      descripcion: articulo.descripcion || "",
      precio_dia: articulo.precio_dia.toString(),
      stock_total: articulo.stock_total.toString(),
    })
    router.push(`/articulos/nuevo?${params.toString()}`)
  }, [router])

  const articulosFiltrados = articulos.filter((articulo) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      articulo.nombre.toLowerCase().includes(query) ||
      articulo.codigo.toLowerCase().includes(query) ||
      articulo.categoria.toLowerCase().includes(query) ||
      (articulo.descripcion?.toLowerCase() || "").includes(query)
    )
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando artículos...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Mostrando {articulosFiltrados.length} de {articulos.length} artículos
        </p>
        <div className="flex items-center gap-2">
          <Button variant={viewMode === "grid" ? "default" : "outline"} size="sm" onClick={() => setViewMode("grid")}>
            Cuadrícula
          </Button>
          <Button variant={viewMode === "list" ? "default" : "outline"} size="sm" onClick={() => setViewMode("list")}>
            Lista
          </Button>
        </div>
      </div>

      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {articulosFiltrados.map((articulo) => (
            <ArticuloGridItem key={articulo.id} articulo={articulo} onEliminar={handleEliminar} onDuplicar={handleDuplicar} />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {articulosFiltrados.map((articulo) => (
            <ArticuloListItem key={articulo.id} articulo={articulo} onEliminar={handleEliminar} onDuplicar={handleDuplicar} />
          ))}
        </div>
      )}
    </div>
  )
}

function ArticuloGridItem({ articulo, onEliminar, onDuplicar }: { articulo: ArticuloType; onEliminar: (id: string) => void; onDuplicar: (articulo: ArticuloType) => void }) {
  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <div className="aspect-square relative">
        <Image src={getImageUrl(articulo, 400, 400)} alt={articulo.nombre} fill className="object-cover" />
        <div className="absolute top-2 right-2">
          <ArticuloAcciones articulo={articulo} onEliminar={onEliminar} onDuplicar={onDuplicar} />
        </div>
      </div>
      <CardContent className="p-4">
        <div className="space-y-2">
          <div className="flex items-start justify-between">
            <h3 className="font-semibold text-sm leading-tight">{articulo.nombre}</h3>
            <Badge variant="secondary" className="text-xs">
              {articulo.categoria}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">{articulo.descripcion}</p>
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">€{articulo.precio_dia}/día</span>
            <span className="text-muted-foreground">
              {articulo.stock_disponible}/{articulo.stock_total} disponibles
            </span>
          </div>
          <div className="flex items-center justify-between">
            <Badge variant={articulo.stock_disponible > 0 ? "default" : "secondary"} className="text-xs">
              {articulo.stock_disponible > 0 ? "Disponible" : "Sin stock"}
            </Badge>
            <div className="w-full bg-muted rounded-full h-2 ml-3">
              <div
                className="bg-primary h-2 rounded-full"
                style={{
                  width: `${(articulo.stock_disponible / articulo.stock_total) * 100}%`,
                }}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ArticuloListItem({ articulo, onEliminar, onDuplicar }: { articulo: ArticuloType; onEliminar: (id: string) => void; onDuplicar: (articulo: ArticuloType) => void }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 relative flex-shrink-0">
            <Image src={getImageUrl(articulo, 64, 64)} alt={articulo.nombre} fill className="object-cover rounded-lg" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold">{articulo.nombre}</h3>
                <p className="text-sm text-muted-foreground">{articulo.descripcion}</p>
              </div>
              <ArticuloAcciones articulo={articulo} onEliminar={onEliminar} onDuplicar={onDuplicar} />
            </div>
            <div className="flex items-center gap-4 mt-2">
              <Badge variant="secondary">{articulo.categoria}</Badge>
              <span className="text-sm font-medium">€{articulo.precio_dia}/día</span>
              <span className="text-sm text-muted-foreground">
                {articulo.stock_disponible}/{articulo.stock_total} disponibles
              </span>
              <Badge variant={articulo.stock_disponible > 0 ? "default" : "secondary"}>
                {articulo.stock_disponible > 0 ? "Disponible" : "Sin stock"}
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
