"use client"

import { ColumnDef } from "@tanstack/react-table"
import { useClients, useDeleteClient } from "@/hooks/use-clients"
import { DataTable } from "@/components/data-table/data-table"
import type { Client } from "@/types/database"
import { Button } from "@/components/ui/button"
import { MoreHorizontal, Pencil, Trash2, Eye } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import Link from "next/link"
import { toast } from "sonner"
import { LoadingScreen } from "@/components/ui/loading-screen"

export default function ClientsPage() {
  const { data: clients, isLoading } = useClients()
  const deleteClient = useDeleteClient()

  const handleDelete = async (id: string) => {
    try {
      await deleteClient.mutateAsync(id)
      toast.success("Client supprimé avec succès")
    } catch {
      toast.error("Erreur lors de la suppression du client")
    }
  }

  const columns: ColumnDef<Client>[] = [
    {
      accessorKey: "code",
      header: "Code",
      cell: ({ row }) => <span className="font-mono font-bold text-xs">{row.original.code}</span>,
    },
    {
      accessorKey: "raison_sociale",
      header: "Raison sociale",
      cell: ({ row }) => (
        <div className="max-w-[220px] truncate font-medium text-xs text-foreground" title={row.original.raison_sociale}>
          {row.original.raison_sociale}
        </div>
      ),
    },
    {
      accessorKey: "ville",
      header: "Ville",
      cell: ({ row }) => <span className="text-xs">{row.original.ville || "—"}</span>,
    },
    {
      accessorKey: "telephone",
      header: "Téléphone",
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.telephone || "—"}</span>,
    },
    {
      accessorKey: "email",
      header: "E-mail",
      cell: ({ row }) => (
        <div className="max-w-[180px] truncate text-xs text-muted-foreground" title={row.original.email || ""}>
          {row.original.email || "—"}
        </div>
      ),
    },
    {
      accessorKey: "ice",
      header: "ICE",
      cell: ({ row }) => <span className="font-mono text-[11px] text-muted-foreground">{row.original.ice || "—"}</span>,
    },
    {
      id: "actions",
      enableSorting: false,
      cell: ({ row }) => {
        const client = row.original
        return (
          <div onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/clients/${client.id}`}>
                    <Eye className="mr-2 h-4 w-4" />
                    Voir
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/clients/${client.id}/modifier`}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Modifier
                  </Link>
                </DropdownMenuItem>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Supprimer
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
                      <AlertDialogDescription>
                        Voulez-vous vraiment supprimer le client &quot;{client.raison_sociale}&quot; ?
                        Cette action est irréversible.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(client.id)}>
                        Supprimer
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      },
    },
  ]

  if (isLoading) return <LoadingScreen />

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Clients</h2>
        <p className="text-muted-foreground">Gérez vos clients</p>
      </div>
      <DataTable
        columns={columns}
        data={clients || []}
        searchPlaceholder="Rechercher un client..."
        createUrl="/clients/nouveau"
        createLabel="Nouveau client"
        getRowHref={(row) => `/clients/${row.id}`}
      />
    </div>
  )
}
