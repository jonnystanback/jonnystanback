# jonnystanback.com

Built with Astro. Same site as before, now with one shared layout so new
sections (In The Field / Field Notes) can be added cleanly.

## Run it on your Mac
    npm install        # first time only
    npm run dev        # open http://localhost:4321

## Where things live
    public/                  images, video, font, style.css (served as-is)
    src/layouts/Base.astro   <head>, social tags, header, footer for every page
    src/components/          Header (nav links) and Footer
    src/pages/               one file per page: index, tour, music, merch
                             tour.astro: add shows to the `shows` list

## Publish
    npm run build      # outputs the finished site to dist/
