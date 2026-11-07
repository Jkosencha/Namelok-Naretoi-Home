NAMELOK NARETOI HOME - PROGRAMME PAGES (v3, works with the navbar component)
===========================================================================
Each page now has <div id="navbar"></div> and loads, in this order at the end of <body>:
    jcomponents/navbar.js        <- YOUR navbar component (not included in this zip)
    js/program-nav.js   <- scroll effects, back-to-top, reveal, footer year
Only css/program-pages.css is loaded for styling (no style.css / index.js needed).

IMPORTANT
 - If your navbar component file is not components/navbar.js, change that one <script src> line
   in the six pages. It must load BEFORE program-nav.js.
 - program-nav.js no longer touches the menu, so it can't fight your component's toggle.
 - All links are relative .html links (index.html, services.html, ...) like your component.
   Pages must sit in the site root next to index.html.

INSTALL
 1. Copy the six .html files to the site root.
 2. Copy css/program-pages.css and js/program-nav.js (overwrite the earlier versions).
 3. Images read from images/ : logo.png, upArrow.svg, topography.svg, namelokBG.jpg,
    namelokBG2.jpg, nam5.jpg, nam6.jpg, nam10.jpg, aboutUs.jpg, aboutUs3.jpg, sch1.jpg,
    hsp1.jpg, rescued1.jpeg
