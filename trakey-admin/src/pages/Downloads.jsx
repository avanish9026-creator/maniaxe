import { useMemo, useState } from "react";
import { Badge, Button, Card, Empty, Icon, PageHead, useCopy } from "../lib/ui";

// Dropbox links for every build, source and asset file. To add or change one, edit this list and rebuild.
// g = group heading, f = file name, u = Dropbox share link.
const FILES = [
  {"g": "App installers (APK)", "f": "Ledra-1-2-3.apk", "u": "https://www.dropbox.com/scl/fi/68c7yg3fuxlknemc84ycz/Ledra-1-2-3.apk?rlkey=5wwegvixpb2p9ejj40jhc46gv&st=278kfe7s&dl=0"},
  {"g": "App installers (APK)", "f": "Reelingo_D-0-1.apk", "u": "https://www.dropbox.com/scl/fi/mvyckz4pzkbfyg8mturrx/Reelingo_D-0-1.apk?rlkey=2iasjka1rt4q2qeby27ftyeqw&st=olgwhw4w&dl=0"},
  {"g": "App installers (APK)", "f": "Trakey-5-1-2.apk", "u": "https://www.dropbox.com/scl/fi/53n3cuuj8lqoo547a8uw1/Trakey-5-1-2.apk?rlkey=ih6fzqmgdjustlfiyj7hcikkf&st=5ntj3zj4&dl=0"},
  {"g": "Trakey", "f": "TKY_512_DOT-ANDROID.zip", "u": "https://www.dropbox.com/scl/fi/ukrxhk9amzjeemy2zbjia/TKY_512_DOT-ANDROID.zip?rlkey=1hs08o5ztytbllav81jr8j3ai&st=v5vuglcy&dl=0"},
  {"g": "Trakey", "f": "TKY_ADM-V05.zip", "u": "https://www.dropbox.com/scl/fi/4rjb45n4togsepyhm00q3/TKY_ADM-V05.zip?rlkey=d27hcy7thba6hv9yak5k49514&st=86i5014m&dl=0"},
  {"g": "Trakey", "f": "TKY_ASSET_512.zip", "u": "https://www.dropbox.com/scl/fi/tbno2zqu0cfoikme33r5i/TKY_ASSET_512.zip?rlkey=skg8s1pp2f3ocd4kemww87au9&st=6gl94flr&dl=0"},
  {"g": "Trakey", "f": "TKY_DOT-WRANGLER.zip", "u": "https://www.dropbox.com/scl/fi/ch2mv16alhkpju3rgf67j/TKY_DOT-WRANGLER.zip?rlkey=8v2xjootdwaatyv0xpvcnm89x&st=w8m597vo&dl=0"},
  {"g": "Trakey", "f": "TKY_FIREBASE-RULES.zip", "u": "https://www.dropbox.com/scl/fi/4bex3e0slkn3eafn1bh8d/TKY_FIREBASE-RULES.zip?rlkey=y8gaegdtwj8tf7u3pzt6sphd6&st=u2kx7zjb&dl=0"},
  {"g": "Trakey", "f": "TKY_LGL_512.zip", "u": "https://www.dropbox.com/scl/fi/8fnnecj4ok2n7447zammw/TKY_LGL_512.zip?rlkey=iphsg9emh61bifdi7ek0j57hm&st=s5567hs4&dl=0"},
  {"g": "Trakey", "f": "TKY_MD_512.zip", "u": "https://www.dropbox.com/scl/fi/cgu7co56bbcj64z7wge8w/TKY_MD_512.zip?rlkey=3r2xwj8azwv0sw5billoty88y&st=2ete4tl5&dl=0"},
  {"g": "Trakey", "f": "TKY_SRC_512-UP.zip", "u": "https://www.dropbox.com/scl/fi/1v91veoxspik10gerdo4y/TKY_SRC_512-UP.zip?rlkey=n9f8q64cf95sfk23ig34h64e7&st=p5ledk1y&dl=0"},
  {"g": "Trakey", "f": "TKY_SS_512.zip", "u": "https://www.dropbox.com/scl/fi/fei2gkioi8o9hywxg2wr5/TKY_SS_512.zip?rlkey=t28e00bpkbrfh06jiyolh2cui&st=ffod6fhs&dl=0"},
  {"g": "Trakey", "f": "TKY-FRESH-OTHER-FILE.zip", "u": "https://www.dropbox.com/scl/fi/1rblbsyqyd2yx431e25tc/TKY-FRESH-OTHER-FILE.zip?rlkey=2tdtyw4m263j5qb4u7vl6fb4y&st=d0rh79xx&dl=0"},
  {"g": "Ledra", "f": "LDA_ASSET_123.zip", "u": "https://www.dropbox.com/scl/fi/5l803f0fkyceqn3jj7fx4/LDA_ASSET_123.zip?rlkey=lu2rmzbis7tfr5u7ae39omk1d&st=ii90ac02&dl=0"},
  {"g": "Ledra", "f": "LDA_LGL_123.zip", "u": "https://www.dropbox.com/scl/fi/eyvrq9vibz3au37upzq1g/LDA_LGL_123.zip?rlkey=aykurpyggiwuz9cvx6649es6m&st=we9rpbas&dl=0"},
  {"g": "Ledra", "f": "LDA_MD_123.zip", "u": "https://www.dropbox.com/scl/fi/t0k9vyzwp4fjmxj3ufow5/LDA_MD_123.zip?rlkey=41qwehjfcmdiisxahrsfnbbq5&st=gd1xs0yh&dl=0"},
  {"g": "Ledra", "f": "LDA_SRC_123.zip", "u": "https://www.dropbox.com/scl/fi/lhi9wm44sqn8z7347eynw/LDA_SRC_123.zip?rlkey=nrs5qopsqnisdql7s14njoska&st=melr8605&dl=0"},
  {"g": "Ledra", "f": "LDA_SS_123.zip", "u": "https://www.dropbox.com/scl/fi/zdzyv02z9vragfmwgqgk4/LDA_SS_123.zip?rlkey=6kh86zk18uqksx866gzbuqxca&st=at9xnwrq&dl=0"},
  {"g": "Reelingo", "f": "RLO_MD_01.zip", "u": "https://www.dropbox.com/scl/fi/3ipat2r8s7qmfm7dhaqb9/RLO_MD_01.zip?rlkey=012bo687p4o2y9t8xim3sa37f&st=boo9sn4m&dl=0"},
  {"g": "Reelingo", "f": "RLO_SRC_01.zip", "u": "https://www.dropbox.com/scl/fi/0pnp6za7xz0ny73lh8eme/RLO_SRC_01.zip?rlkey=4i4qxwnk1u3cylpxnknm9yc8k&st=l9bs9r3e&dl=0"},
  {"g": "Reelingo", "f": "RLO_SS_01.zip", "u": "https://www.dropbox.com/scl/fi/ahui005wdcvzwx9pkpgni/RLO_SS_01.zip?rlkey=19qqw78l58c86xs78vz4snugs&st=phfscfgp&dl=0"},
  {"g": "Maniaxe", "f": "MNX__SRC_04-UP.zip", "u": "https://www.dropbox.com/scl/fi/ph2zwr27e2vfuuug6ntum/MNX__SRC_04-UP.zip?rlkey=q1t7mgvd9k7y61ufwl2hap8h8&st=gw2iw6ft&dl=0"},
  {"g": "T-Labs", "f": "TLABS_ASSET.zip", "u": "https://www.dropbox.com/scl/fi/q9k4rht2uh4z60uuvhs7b/TLABS_ASSET.zip?rlkey=xv17a29en0qse7za71rdzq4e1&st=qf0flhzp&dl=0"},
  {"g": "T-Labs", "f": "TLABS_CHANGES-512.zip", "u": "https://www.dropbox.com/scl/fi/z0cb9397qsq0cx7gluluw/TLABS_CHANGES-512.zip?rlkey=vavsh0hpwy8v3nlu1fpnqoi2r&st=nors8ekg&dl=0"},
  {"g": "T-Labs", "f": "TLABS_OTHER.zip", "u": "https://www.dropbox.com/scl/fi/g923ts2387544kc6jecy9/TLABS_OTHER.zip?rlkey=586089ep8hob219gt3jlub9fv&st=kr71yc7k&dl=0"},
  {"g": "T-Labs", "f": "TLABS.zip", "u": "https://www.dropbox.com/scl/fi/z415o27zpzrx1tma8rine/TLABS.zip?rlkey=ijbmcydwsv0nzbw2eiq5v6v8t&st=ne4tvv6m&dl=0"},
  {"g": "TLP bundles", "f": "TLP_APP_3_APK.zip", "u": "https://www.dropbox.com/scl/fi/vro1ifh74a682vrxrmcwl/TLP_APP_3_APK.zip?rlkey=u3gywxehd56krl4yfvoq0d32z&st=72z9mc8e&dl=0"},
  {"g": "TLP bundles", "f": "TLP_WEB_4_SS.zip", "u": "https://www.dropbox.com/scl/fi/dm1r4xutf9mj77ywog2ub/TLP_WEB_4_SS.zip?rlkey=e8639tuwwvl4sizljnu1efuf4&st=7cmd9j1x&dl=0"},
  {"g": "TLP bundles", "f": "TLP1-_TKY_V512-UP2.zip", "u": "https://www.dropbox.com/scl/fi/5rjr4zlt6rdf0rgsv8x6z/TLP1-_TKY_V512-UP2.zip?rlkey=w53vynx83s8nhesd3u9s66mml&st=3tlifu33&dl=0"},
  {"g": "TLP bundles", "f": "TLP2_LDA_V123.zip", "u": "https://www.dropbox.com/scl/fi/uq9pbkq8eniydox5vlzv0/TLP2_LDA_V123.zip?rlkey=nivta0m7k3uwod82eu3fp0n8o&st=714veg0x&dl=0"},
  {"g": "TLP bundles", "f": "TLP3_RLO_V01.zip", "u": "https://www.dropbox.com/scl/fi/1fc99dg047ban4wyi330w/TLP3_RLO_V01.zip?rlkey=jh1egojdyfokxadcezu0s2n4a&st=sz0iyjvb&dl=0"},
  {"g": "TLP bundles", "f": "TLP4_MNX_04-UP.zip", "u": "https://www.dropbox.com/scl/fi/t6r54s5qwqt0jh0ilzdbk/TLP4_MNX_04-UP.zip?rlkey=v28cecuk2nbkobvz3zo0utkpb&st=8g7c5vo0&dl=0"},
];

const GROUPS = ["App installers (APK)", "Trakey", "Ledra", "Reelingo", "Maniaxe", "T-Labs", "TLP bundles"];

// Dropbox share links end in dl=0 (opens a preview page). dl=1 makes the same link download straight away.
const direct = (u) => u.replace(/([?&])dl=0/, "$1dl=1");

export default function Downloads() {
  const [q, setQ] = useState("");
  const copy = useCopy();
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return FILES.filter((f) => !s || f.f.toLowerCase().includes(s) || f.g.toLowerCase().includes(s));
  }, [q]);

  return (
    <>
      <PageHead title="Downloads" subtitle={FILES.length + " files with their Dropbox links. Open the share page, download directly, or copy the link."} />
      <div className="toolbar">
        <div className="search-box">
          <Icon name="search" size={17} />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search file name or project" />
        </div>
      </div>
      {!shown.length && <Empty icon="file" title="No files match">Try a different word.</Empty>}
      {GROUPS.map((g) => {
        const rows = shown.filter((f) => f.g === g);
        if (!rows.length) return null;
        return (
          <Card key={g} title={g} subtitle={rows.length + (rows.length === 1 ? " file" : " files")} className="mb">
            <div className="list">
              {rows.map((f) => (
                <div className="list-row" key={f.f}>
                  <span className="tl-ic accent"><Icon name="file" size={16} /></span>
                  <div className="list-main">
                    <b className="mono" style={{ overflowWrap: "anywhere" }}>{f.f}</b>
                  </div>
                  <div className="list-end" style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                    {f.f.endsWith(".apk") && <Badge tone="ok">APK</Badge>}
                    <a className="btn btn-soft btn-sm" href={f.u} target="_blank" rel="noopener noreferrer"><Icon name="link" size={15} /><span>Open</span></a>
                    <a className="btn btn-default btn-sm" href={direct(f.u)} rel="noopener noreferrer"><Icon name="download" size={15} /><span>Download</span></a>
                    <Button size="sm" icon="copy" onClick={() => copy(f.u, "Link copied")}>Copy</Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        );
      })}
    </>
  );
}
