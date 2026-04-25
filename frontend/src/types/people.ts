export type Person = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type CreatePersonInput = {
  name: string;
  email?: string;
  phone?: string;
};

export type UpdatePersonInput = Partial<CreatePersonInput>;