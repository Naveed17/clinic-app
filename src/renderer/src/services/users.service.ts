import type { UserInput, UserListInput, UserUpdateInput } from '@/types/user';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const clinic = (window as any).clinic;

export const usersService = {
  list: (input: UserListInput) => clinic.users.list(input),
  create: (input: UserInput) => clinic.users.create(input),
  update: (id: string, input: UserUpdateInput) => clinic.users.update(id, input),
  delete: (id: string) => clinic.users.delete(id),
};
