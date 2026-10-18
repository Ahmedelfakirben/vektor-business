"use client"

import { useState } from "react"
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ChevronLeft, ChevronRight, Search, Plus, ArrowUpDown, ArrowUp, ArrowDown, FileSpreadsheet, Loader2, SlidersHorizontal } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  searchKey?: string
  searchPlaceholder?: string
  createUrl?: string
  createLabel?: string
  globalFilter?: string // Controlled state
  onGlobalFilterChange?: (value: string) => void // Controlled updater
  getRowHref?: (data: TData) => string
  onExportExcel?: (filteredData: TData[]) => void
  exportingExcel?: boolean
  initialColumnVisibility?: VisibilityState
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchKey,
  searchPlaceholder = "Rechercher...",
  createUrl,
  createLabel = "Nouveau",
  globalFilter: externalGlobalFilter,
  onGlobalFilterChange: setExternalGlobalFilter,
  getRowHref,
  onExportExcel,
  exportingExcel = false,
  initialColumnVisibility = {},
}: DataTableProps<TData, TValue>) {
  const router = useRouter()
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(initialColumnVisibility)
  const [internalGlobalFilter, setInternalGlobalFilter] = useState("")

  const globalFilter = externalGlobalFilter !== undefined ? externalGlobalFilter : internalGlobalFilter
  const setGlobalFilter = setExternalGlobalFilter || setInternalGlobalFilter

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter,
    },
    globalFilterFn: (row, columnId, filterValue) => {
      const value = row.getValue(columnId)
      if (value == null) return false
      
      const searchStr = String(filterValue).toLowerCase()
      
      if (typeof value === "object") {
        const obj = value as any
        const combined = `${obj.nom || ""} ${obj.raison_sociale || ""} ${obj.prenom || ""} ${obj.code || ""}`.toLowerCase()
        return combined.includes(searchStr)
      }

      return String(value).toLowerCase().includes(searchStr)
    },
    initialState: {
      pagination: { pageSize: 20 },
    },
  })

  return (
    <div className="space-y-4 w-full max-w-full">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={globalFilter ?? ""}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-9 h-9 text-xs rounded-xl"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs rounded-xl">
                <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Colonnes</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 max-h-72 overflow-y-auto rounded-xl">
              <DropdownMenuLabel className="text-xs font-semibold">Afficher / Masquer</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {table
                .getAllColumns()
                .filter((column) => typeof column.accessorFn !== "undefined" || column.id !== "actions")
                .map((column) => {
                  const header = column.columnDef.header
                  const label = typeof header === "string" && header.trim() ? header : column.id
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="text-xs capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) => column.toggleVisibility(!!value)}
                    >
                      {label}
                    </DropdownMenuCheckboxItem>
                  )
                })}
            </DropdownMenuContent>
          </DropdownMenu>

          {onExportExcel && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onExportExcel(table.getFilteredRowModel().rows.map((r) => r.original))}
              disabled={exportingExcel}
              className="h-9 text-xs rounded-xl text-green-700 bg-green-50 hover:bg-green-100 hover:text-green-800 border-green-200"
            >
              {exportingExcel ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" />}
              Excel
            </Button>
          )}

          {createUrl && (
            <Button asChild size="sm" className="h-9 text-xs font-bold rounded-xl">
              <Link href={createUrl}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                {createLabel}
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border/70 bg-card shadow-xs overflow-hidden w-full max-w-full">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort()
                  const sortDir = header.column.getIsSorted()
                  
                  return (
                    <TableHead 
                      key={header.id}
                      className={canSort ? "cursor-pointer select-none hover:bg-muted/30 transition-colors" : ""}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {header.isPlaceholder ? null : (
                        <div className="flex items-center gap-2">
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                          {canSort && (
                            <div className="text-muted-foreground/50">
                              {sortDir === "asc" ? (
                                <ArrowUp className="h-4 w-4 text-foreground" />
                              ) : sortDir === "desc" ? (
                                <ArrowDown className="h-4 w-4 text-foreground" />
                              ) : (
                                <ArrowUpDown className="h-4 w-4" />
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow 
                  key={row.id}
                  className={getRowHref ? "cursor-pointer hover:bg-muted/50 transition-colors" : ""}
                  onClick={() => {
                    if (getRowHref) {
                      router.push(getRowHref(row.original))
                    }
                  }}
                  onAuxClick={(e) => {
                    if (e.button === 1 && getRowHref) {
                      window.open(getRowHref(row.original), '_blank')
                    }
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  Aucun résultat trouvé.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {table.getFilteredRowModel().rows.length} résultat(s)
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="h-4 w-4" />
            Précédent
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {table.getState().pagination.pageIndex + 1} sur{" "}
            {table.getPageCount()}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Suivant
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
