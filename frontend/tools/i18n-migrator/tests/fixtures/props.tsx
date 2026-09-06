import { Link } from "react-router-dom";

export function PropsFixture() {
  return (
    <div>
      <input placeholder="Search people" />
      <Link to="/people">People</Link>
    </div>
  );
}
