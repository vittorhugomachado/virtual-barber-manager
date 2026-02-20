import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  return (
    <div className="w-full max-w-lg lg:max-w-285 lg:flex lg:items-center justify-center lg:h-screen lg:w-[50vw] lg:bg-card text-card-foreground lg:border-l border-zinc-300">
      <Card className="w-full max-w-lg lg:border-none lg:rounded-none lg:shadow-none">
        <CardHeader>
          <CardTitle className="lg:text-3xl lg:-translate-y-20">
            Entrar na Virtual
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="barbearia@email.com"
                  required
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">Senha</Label>
                  <a
                    href="#"
                    className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                  >
                    Esqueceu sua senha?
                  </a>
                </div>
                <Input id="password" type="password" required />
              </div>
            </div>
          </form>
        </CardContent>
        <CardFooter className="flex-col gap-2">
          <Button type="submit" className="w-full max-w-xs">
            Login
          </Button>
          <Button variant="link">Criar conta</Button>
        </CardFooter>
      </Card>
    </div>
  );
}
