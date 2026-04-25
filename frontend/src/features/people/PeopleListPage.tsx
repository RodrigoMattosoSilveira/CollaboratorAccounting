import { useEffect, useState } from 'react';
import { apiGet } from '../../api/client';

type Person = { id: string; name: string; statusId: string };

export default function PeopleListPage() {
  const [people, setPeople] = useState<Person[]>([]);
  useEffect(() => { apiGet<Person[]>('/people').then(setPeople).catch(console.error); }, []);
  return <section><h1>People</h1>{people.length === 0 ? <p>No people yet.</p> : people.map(p => <article className="card" key={p.id}>{p.name}</article>)}</section>;
}
