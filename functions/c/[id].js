// /c/<id>  ->  the app, which shows the booking behind the short link
export async function onRequestGet({ request, params }) {
  const url = new URL(request.url);
  const id = String(params.id || '').replace(/[^a-z0-9]/gi, '').slice(0, 16);
  return Response.redirect(`${url.origin}/#/k/${id}`, 302);
}
