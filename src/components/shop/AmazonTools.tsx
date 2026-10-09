"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The script behind the "Send to shop" button. It runs in the customer's own browser, on the Amazon page they are looking at, reads the item's
 * title, product number and (only if it is in pounds) the price shown to them, and opens the request form with those filled in. The shop never
 * contacts Amazon. The price it passes on is only a guide: staff check the real price before anything is bought.
 */
const SCRIPT = String.raw`(function(){
var h=location.hostname;
if(!/(^|\.)amazon\.[a-z.]+$/.test(h)){alert('Open an item on Amazon UK first, then press this button.');return;}
if(!/amazon\.co\.uk$/.test(h)){alert('This is not the UK store. We buy from Amazon UK, so please open the item on amazon.co.uk.');return;}
var q=function(s){return document.querySelector(s)};
var t=(q('#productTitle')||{}).textContent||document.title||'';
var p=q('#corePrice_feature_div .a-offscreen')||q('.priceToPay .a-offscreen')||q('#priceblock_ourprice')||q('.a-price .a-offscreen');
var m1=((p&&p.textContent)||'').match(/£\s?([\d,]+(?:\.\d{1,2})?)/);
var im=(q('#landingImage')||{}).src||'';
var m=location.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})/);
var a=new URLSearchParams({url:m?location.origin+'/dp/'+m[1]:location.href,title:t.replace(/\s+/g,' ').trim().slice(0,160)});
if(m1)a.set('price',m1[1].replace(/,/g,''));
if(/^https:\/\/m\.media-amazon\.com\/images\//.test(im))a.set('img',im);
window.open('ORIGIN/request?'+a.toString(),'_blank');
})();`;

type InstallEvent = Event & { prompt: () => Promise<void> };

export default function AmazonTools({ siteName }: { siteName: string }) {
  const link = useRef<HTMLAnchorElement>(null);
  const [install, setInstall] = useState<InstallEvent | null>(null);

  useEffect(() => {
    // React will not render a javascript: address as a link, so the bookmarklet's address is set on the element directly
    link.current?.setAttribute("href", `javascript:${encodeURIComponent(SCRIPT.replace("ORIGIN", location.origin))}`);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  return (
    <div className="grid gap-6">
      <section className="box p-5" aria-labelledby="phone-h">
        <h3 id="phone-h" className="text-xl">On an Android phone: Share straight to us</h3>
        <ol className="mt-2 list-decimal pl-5 text-sm">
          <li>Install {siteName} on your phone{install ? <> with the button below</> : <> (in Chrome: menu, then <strong>Add to Home screen</strong> or <strong>Install app</strong>)</>}.</li>
          <li>In the Amazon app, open an item, tap <strong>Share</strong>, and choose <strong>{siteName}</strong>.</li>
          <li>The request form opens with the item filled in. Add your size or colour, and send.</li>
        </ol>
        {install && (
          <button type="button" className="btn btn-primary mt-3" onClick={() => { void install.prompt(); setInstall(null); }}>Install {siteName} on this phone</button>
        )}
        <p className="hint mt-2">iPhones do not offer Share to a website. On an iPhone, copy the link and paste it in the box above.</p>
      </section>

      <section className="box p-5" aria-labelledby="desk-h">
        <h3 id="desk-h" className="text-xl">On a computer: one-click button</h3>
        <p className="mt-2 text-sm">
          Drag this button to your browser&rsquo;s bookmarks bar. Then, on any Amazon UK item, click it. It opens the request form with the item&rsquo;s name and the price you can see filled in.
        </p>
        <p className="mt-3">
          <a ref={link} href="#" onClick={(e) => { if (e.currentTarget.getAttribute("href") === "#") e.preventDefault(); }} className="btn btn-gold cursor-grab" draggable>Send to {siteName}</a>
        </p>
        <p className="hint mt-2">It only reads the page you are looking at, in your own browser. We never contact Amazon.</p>
      </section>
    </div>
  );
}
