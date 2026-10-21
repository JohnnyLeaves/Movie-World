export const GENRES = [
  "Action",
  "Adventure",
  "Animation",
  "Comedy",
  "Crime",
  "Documentary",
  "Drama",
  "Family",
  "Fantasy",
  "History",
  "Horror",
  "Mystery",
  "Romance",
  "Sci-Fi",
  "Thriller",
  "War",
  "Western",
];
// genre may be one name, a comma list, or `genres` an array; a title must have all of them.
export function matchesFilters(
  title,
  { genre = "", genres = [], year = "", yearFrom = "", yearTo = "", minScore = 0 } = {},
) {
  const wanted = genres.length ? genres : String(genre || "").split(",").filter(Boolean),
    from = Number(yearFrom || year) || 0,
    to = Number(yearTo || year) || 0;
  return (
    wanted.every(
      (g) =>
        title.genres.includes(g) ||
        (g === "Sci-Fi" && title.genres.includes("Science Fiction")),
    ) &&
    (!from || (title.year && title.year >= from)) &&
    (!to || (title.year && title.year <= to)) &&
    (!Number(minScore) || title.score >= Number(minScore))
  );
}
