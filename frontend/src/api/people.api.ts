import { apiDelete, apiGet, apiPost, apiPut } from "./client";
import type {
  CreatePersonInput,
  Person,
  UpdatePersonInput,
} from "../types/people";

export function listPeople(): Promise<Person[]> {
  return apiGet<Person[]>("/people");
}

export function getPerson(id: string): Promise<Person> {
  return apiGet<Person>(`/people/${id}`);
}

export function createPerson(input: CreatePersonInput): Promise<Person> {
  return apiPost<CreatePersonInput, Person>("/people", input);
}

export function updatePerson(
  id: string,
  input: UpdatePersonInput
): Promise<Person> {
  return apiPut<UpdatePersonInput, Person>(`/people/${id}`, input);
}

export function deletePerson(id: string): Promise<void> {
  return apiDelete<void>(`/people/${id}`);
}

export const peopleApi = {
  list: listPeople,
  get: getPerson,
  create: createPerson,
  update: updatePerson,
  delete: deletePerson,
};