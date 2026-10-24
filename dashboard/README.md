# Namelok admin dashboard

The source of the admin dashboard served at `/admin/`. React, TypeScript, Tailwind and shadcn/ui, built with Vite.

## Working on it

```sh
cd dashboard
npm install
npm run dev      # http://localhost:5173/?demo  (demo data, nothing is saved)
```

The dashboard reads the Supabase connection from `../js/supabase-config.js`, the same file the website uses.

## Publishing changes

```sh
npm run build    # writes the finished dashboard into ../admin
```

Commit both `dashboard/` and `admin/`. The website host only needs `admin/`.

Database changes live in `../supabase/updates/`: run each new file once in the Supabase SQL Editor.
