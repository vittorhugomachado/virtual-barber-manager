-- Limita o nome da barbearia a no máximo 30 caracteres
ALTER TABLE barbershops
  ADD CONSTRAINT barbershops_name_max_length CHECK (char_length(name) <= 30);
