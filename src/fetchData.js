const { parquetReadObjects } = await import("hyparquet");
// hyparquet only ships Snappy; the dataset is written with ZSTD.
const { compressors } = await import("hyparquet-compressors");

// The dev server answers a missing file with index.html and a 200, so check the
// type too, or the failure surfaces later as a confusing parse error.
async function fetchOk(url) {
  const response = await fetch(url);
  const type = response.headers.get("Content-Type") ?? "";
  if (!response.ok || type.startsWith("text/html")) {
    throw new Error(`Could not fetch ${url}: ${response.status} ${type}`);
  }
  return response;
}

export async function fetchJson(url) {
  return (await fetchOk(url)).json();
}

export async function fetchParquet(url) {
  const buffer = await (await fetchOk(url)).arrayBuffer();
  const file = {
    byteLength: buffer.byteLength,
    slice: (start, end) => buffer.slice(start, end),
  };
  return parquetReadObjects({ file, compressors });
}
