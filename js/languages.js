/* ==========================================================================
   MANIAXE TYPING — LANGUAGE WORD BANKS
   20 languages. Each maps to a display name, a Google Font suited to its
   script, and a common-word list used to generate test content.
   ========================================================================== */

const MANIAXE_LANGUAGES = {

  english: {
    label: "English",
    font: "'JetBrains Mono', monospace",
    words: "the be to of and a in that have I it for not on with he as you do at this but his by from they we say her she or an will my one all would there their what so up out if about who get which go me when make can like time no just him know take people into year your good some could them see other than then now look only come its over think also back after use two how our work first well way even new want because any these give day most us".split(" ")
  },

  spanish: {
    label: "Español",
    font: "'JetBrains Mono', monospace",
    words: "el la de que y a en un ser se no haber por con su para como estar tener le lo lo todo pero más hacer o poder decir este ir otro ese si me ya ver dar cuando muy sin vez mucho saber qué sobre mi alguno mismo yo también hasta año dos día cosa mundo vida tiempo casa mano parte años trabajo mujer noche ojo caso hombre agua persona forma".split(" ")
  },

  french: {
    label: "Français",
    font: "'JetBrains Mono', monospace",
    words: "le de un être et à il avoir ne je son que se qui ce dans en du elle au de ce le pour pas que vous par sur faire plus dire me on mon lui nous comme mais pouvoir avec tout y aller voir en bien où sans tu ou leur homme temps très savoir falloir mettre autre on prendre premier deux jour même avant grand vouloir".split(" ")
  },

  german: {
    label: "Deutsch",
    font: "'JetBrains Mono', monospace",
    words: "der die und in den von zu das mit sich des auf für ist im dem nicht ein eine als auch es an werden aus er hat dass sie nach wird bei einer um am sind noch wie einem über einen so zum war haben nur oder aber vor zur bis unter während des mehr durch man sein wurde sehr".split(" ")
  },

  portuguese: {
    label: "Português",
    font: "'JetBrains Mono', monospace",
    words: "o de a que e do da em um para com não uma os no se na por mais as dos como mas foi ao ele das tem à seu sua ou ser quando muito há nos já está eu também só pelo pela até isso ela entre era depois sem mesmo aos ter seus quem nas me esse eles estão você tinha foram essa num nem suas meu às minha têm".split(" ")
  },

  italian: {
    label: "Italiano",
    font: "'JetBrains Mono', monospace",
    words: "il di che e la per un in con non una su è del da al le si come lo ma anche o piu quando molto questo essere fare tutto suo loro noi anni tempo casa vita mano giorno mondo parte stato dove chi senza tra dopo primo bene sempre grande stesso perché così due nuovo altro sotto sopra ancora meno oggi".split(" ")
  },

  dutch: {
    label: "Nederlands",
    font: "'JetBrains Mono', monospace",
    words: "de het een en van ik te dat die in is op te zijn met voor niet aan om er maar ook al naar dan wat over uit was zo wel nog geen jaar tijd door heel man dag hand oog leven groot komen goed weer huis zien water werk hier moeten willen zeggen doen".split(" ")
  },

  swedish: {
    label: "Svenska",
    font: "'JetBrains Mono', monospace",
    words: "att och i det som en på är av för den till med han var sig så inte har vi om ett hade de kunde du man detta ha hon min hur nu ja dag liv år kan vara mycket bara efter under just fram två tid göra sitt när igen mer sådan där ny sedan bli väl".split(" ")
  },

  norwegian: {
    label: "Norsk",
    font: "'JetBrains Mono', monospace",
    words: "og i jeg det er du ikke på til å han som var for med av seg men et har hun nå ut hva kunne skal etter meg fra sa noe ville da når min inn dette selv over dem sin mye vi år alle bare vil deg de gjøre kan denne opp mot noen godt to hele igjen tenke".split(" ")
  },

  danish: {
    label: "Dansk",
    font: "'JetBrains Mono', monospace",
    words: "og i jeg det at en den til er som på de med han af for ikke der var mig sig men et har om vi min havde hun nu over da fra du ud sin dette kunne ind når selv vil blev kan meget sådan skal denne godt to bliver noget alle vor efter".split(" ")
  },

  polish: {
    label: "Polski",
    font: "'JetBrains Mono', monospace",
    words: "i w nie na to jest co z za był jak do a się że o ten ale po tak jego ona już ich my go ma pan tylko gdy dla mnie może przez bardzo tam gdzie gdyż gdyby gdzieś dwa gdyż nam wszystko dobrze rok czas dzień ręka".split(" ")
  },

  turkish: {
    label: "Türkçe",
    font: "'JetBrains Mono', monospace",
    words: "bir bu ve ne için de da ben sen o biz siz onlar gibi ile daha çok az var yok evet hayır zaman gün yıl ev su göz el baş kadar sonra önce şimdi burada orada nasıl neden kim hangi büyük küçük iyi kötü yeni eski uzun kısa".split(" ")
  },

  indonesian: {
    label: "Bahasa Indonesia",
    font: "'JetBrains Mono', monospace",
    words: "yang dan di itu dengan untuk tidak ini dari dalam akan pada juga ke karena ada saya kita mereka dia sudah bisa saat oleh setelah para seperti tahun hari waktu orang tempat kerja rumah air mata tangan kepala besar kecil baik buruk baru lama panjang pendek".split(" ")
  },

  vietnamese: {
    label: "Tiếng Việt",
    font: "'Noto Sans Mono', monospace",
    words: "và của là có không được trong một những cho người này với đã như để khi năm ra vào ông bà tôi họ nó chúng ta cũng rất nhiều ít lớn nhỏ tốt xấu mới cũ dài ngắn nước nhà ngày giờ tay đầu mắt việc thời gian".split(" ")
  },

  romanian: {
    label: "Română",
    font: "'JetBrains Mono', monospace",
    words: "și de la un o este în cu pe nu care se din a pentru sau ca dar mai fi au fost avea acest ei ea noi voi ei anul ziua timp casă apă mână cap mare mic bun rău nou vechi lung scurt aici acolo cum unde cine".split(" ")
  },

  finnish: {
    label: "Suomi",
    font: "'JetBrains Mono', monospace",
    words: "ja on ei se että olla joka tämä hän mutta niin kun kuin oli myös vain jo mitä sen kaikki voi kun jos vielä siis nyt tai heidän me te he vuosi päivä aika talo vesi käsi pää suuri pieni hyvä paha uusi vanha".split(" ")
  },

  czech: {
    label: "Čeština",
    font: "'JetBrains Mono', monospace",
    words: "a v je se na že to jsem ten byl který do za jako i s pro to od tak but co když již který my ona oni jeho její náš váš rok den čas dům voda ruka hlava velký malý dobrý nový starý dlouhý krátký".split(" ")
  },

  hungarian: {
    label: "Magyar",
    font: "'JetBrains Mono', monospace",
    words: "és a az egy nem is hogy van volt de mi ez ő ők mi mint már csak meg vagy ha még nagyon itt ott most akkor év nap idő ház víz kéz fej nagy kicsi jó rossz új régi hosszú rövid ki hol miért".split(" ")
  },

  russian: {
    label: "Русский",
    font: "'JetBrains Mono', monospace",
    words: "и в не на я быть тот он с что а по это она они мы как из у который то за свой что весь год так его же для только или её мочь время рука день жизнь глаз слово вода дело человек новый большой хороший".split(" ")
  },

  hindi: {
    label: "हिन्दी",
    font: "'Noto Sans Devanagari', sans-serif",
    words: "और के का है में यह की एक को हैं से पर लिए था कि नहीं कर वह तो हो कुछ जो इस दिया साथ भी अपने किया लोग समय दिन अगर पानी हाथ आंख काम बड़ा छोटा नया पुराना अच्छा बुरा".split(" ")
  }

};

const MANIAXE_PUNCTUATION = [".", ",", "!", "?", ";", ":"];
const MANIAXE_TYPING_FONTS = [
  { label: "JetBrains Mono", value: "'JetBrains Mono', monospace" },
  { label: "Fira Code", value: "'Fira Code', monospace" },
  { label: "Source Code Pro", value: "'Source Code Pro', monospace" },
  { label: "IBM Plex Mono", value: "'IBM Plex Mono', monospace" },
  { label: "Space Mono", value: "'Space Mono', monospace" },
  { label: "Inconsolata", value: "'Inconsolata', monospace" },
  { label: "Ubuntu Mono", value: "'Ubuntu Mono', monospace" },
  { label: "Roboto Mono", value: "'Roboto Mono', monospace" },
  { label: "DM Mono", value: "'DM Mono', monospace" },
  { label: "Red Hat Mono", value: "'Red Hat Mono', monospace" },
  { label: "Courier Prime", value: "'Courier Prime', monospace" },
  { label: "Overpass Mono", value: "'Overpass Mono', monospace" }
];
