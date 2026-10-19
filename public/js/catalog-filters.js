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
export function matchesFilters(
  title,
  { genre = "", year = "", minScore = 0 } = {},
) {
  return (
    (!genre ||
      title.genres.includes(genre) ||
      (genre === "Sci-Fi" && title.genres.includes("Science Fiction"))) &&
    (!year || title.year === Number(year)) &&
    (!Number(minScore) || title.score >= Number(minScore))
  );
}
