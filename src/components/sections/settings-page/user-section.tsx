import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Shield, Eye, Trash2 } from "lucide-react";

// DADOS MOCADOS - SUBSTITUIR PELO BACKEND
type User = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "leitor";
};

const mockUsers: User[] = [
  {
    id: "1",
    name: "Carlos Lima",
    email: "carlos@barbearia.com",
    role: "admin",
  },
  { id: "2", name: "Ana Paula", email: "ana@barbearia.com", role: "leitor" },
];

export function UsersSection() {
  const [users] = useState<User[]>(mockUsers);

  return (
    <div className="w-full max-w-180 mx-16 mt-2 mb-8 flex flex-col gap-4">
      <h3>DADOS MOCADOS !!</h3>
      <div>
        <h2 className="text-xl font-semibold">Usuários</h2>
        <p className="text-sm text-muted-foreground">
          Gerencie quem tem acesso ao painel da sua barbearia.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {users.map(user => (
          <Card key={user.id}>
            <CardContent className="flex items-center justify-between px-5">
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="font-medium truncate">{user.name}</span>
                <span className="text-sm text-muted-foreground truncate">
                  {user.email}
                </span>
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-4">
                <Badge variant="secondary" className="flex items-center gap-1">
                  {user.role === "admin" ? (
                    <>
                      <Shield className="h-3 w-3" /> Admin
                    </>
                  ) : (
                    <>
                      <Eye className="h-3 w-3" /> Leitor
                    </>
                  )}
                </Badge>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-destructive hover:text-destructive cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button variant="outline" className="w-fit cursor-pointer">
        <Plus className="h-4 w-4 mr-2" />
        Novo usuário
      </Button>
    </div>
  );
}
