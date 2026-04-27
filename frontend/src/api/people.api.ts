import { apiFetch } from "./client";
import type {
  CreatePersonInput,
  PeopleListResponse,
  Person,
  UpdatePersonInput,
} from "../types/people";

export async function listPeople(): Promise<Person[]> {
  const response = await apiFetch<PeopleListResponse | Person[]>("/people");

  if (Array.isArray(response)) {
    return response;
  }

  return response.items ?? [];
}

export function getPerson(id: string): Promise<Person> {
  return apiFetch<Person>(`/people/${id}`);
}

export function createPerson(input: CreatePersonInput): Promise<Person> {
  return apiFetch<Person>("/people", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updatePerson(
  id: string,
  input: UpdatePersonInput
): Promise<Person> {
  return apiFetch<Person>(`/people/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}