'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
export type Language = 'rw' | 'en' | 'fr';
// English keys keep existing component copy readable. Preserve proper place names.
const messages: Record<string, [string, string]> = {
  'Unknown': ['Ntibizwi', 'Inconnu'],
  'Source metadata': ['Amakuru y’inkomoko', 'Métadonnées source'],
  "Esri imagery at selected point": ["Amashusho ya Esri ahatoranyijwe", "Imagerie Esri au point sélectionné"],
  "Point metadata only; imagery may vary across the area and by zoom. Independent of building dates.": ["Amakuru ni ay’ahatoranyijwe gusa; amashusho ashobora gutandukana mu gace no ku rwego rwo kwegeza. Ntaho ahuriye n’amatariki y’amakuru y’inyubako.", "Métadonnées du point uniquement ; l’imagerie peut varier selon le lieu et le zoom. Indépendantes des dates des bâtiments."],
  "Point imagery metadata unavailable.": ["Amakuru y’amashusho y’ahatoranyijwe ntaboneka.", "Métadonnées d’imagerie indisponibles à ce point."],
  "Multiple source records at this point; all are listed below.": ["Hari amakuru y’inkomoko nyinshi ahatoranyijwe; yose ari hano hepfo.", "Plusieurs sources à ce point ; elles sont toutes indiquées ci-dessous."],
  "Acquisition date": ["Itariki amashusho yafatiweho", "Date d’acquisition"],
  "Source resolution": ["Ingano ya pigiseli y’inkomoko", "Résolution source"],
  "Sampling resolution": ["Ingano ya pigiseli yatanzwe", "Résolution d’échantillonnage"],
  "Source zoom levels": ["Inzego zo kwegeza z’inkomoko", "Niveaux de zoom source"],
  "Resolution and sampling are not positional accuracy.": ["Ingano ya pigiseli ntigaragaza ukuri kw’aho ikintu giherereye.", "La résolution et l’échantillonnage ne mesurent pas la précision de position."],

  'Data and license': ['Amakuru n’uruhushya rwo kuyakoresha', 'Données et licence'],
  "Building data source": ["Inkomoko y’amakuru y’inyubako", "Source des données de bâtiments"],
  "Broader footprint coverage": ["Amakuru y’inyubako mu duce twinshi", "Couverture des emprises plus étendue"],
  "Changing source selects its latest two available dates. Sources are never added together.": ["Guhindura inkomoko bihitamo amatariki abiri aheruka kuboneka. Imibare y’inkomoko zitandukanye ntiteranywa.", "Changer de source sélectionne ses deux dates disponibles les plus récentes. Les sources ne sont jamais additionnées."],
  "Show counted buildings on map": ["Erekana inyubako zabazwe ku ikarita", "Afficher les bâtiments comptés sur la carte"],
  "Overture shows source footprints. Hide the overlay to inspect the imagery underneath.": ["Overture yerekana imbibi z’inyubako zo mu makuru. Zihishe kugira ngo urebe amashusho ari munsi.", "Overture affiche les emprises sources. Masquez la couche pour examiner l’imagerie dessous."],
  "Actual source footprint; alignment and completeness are unvalidated.": ["Imbibi z’inyubako zo mu makuru; aho ziherereye n’uko zuzuye ntibiragenzurwa.", "Emprise réelle de la source ; alignement et exhaustivité non validés."],
  "Actual source outlines available for all counted records.": ["Imbibi z’inyubako zo mu makuru ziraboneka ku nyubako zose zabazwe.", "Contours sources disponibles pour tous les bâtiments comptés."],
  "Outlines unavailable for this selection. Points and counts remain complete; try a smaller area.": ["Imbibi z’inyubako ntiziboneka kuri aka gace. Utudomo n’imibare y’amakuru biruzuye; gerageza agace gato.", "Contours indisponibles pour cette sélection. Points et comptage source complets ; essayez une zone plus petite."],
  "Tap a colored building to inspect its source, date and use.": ["Kanda ku nyubako ifite ibara urebe inkomoko y’amakuru, itariki n’ikoreshwa ryayo.", "Touchez un bâtiment coloré pour voir sa source, sa date et son usage."],

  'Comparison unavailable: same snapshot, incompatible processing/source, or insufficient mapped coverage.': ['Kugereranya ntibishoboka: amakuru ni amwe, inkomoko cyangwa uburyo bwo kuyatunganya biratandukanye, cyangwa inyubako zanditswe ntizihagije.', 'Comparaison indisponible : même version, sources ou traitements incompatibles, ou couverture cartographique insuffisante.'],
  'Mapped building record': ['Inyubako yanditswe ku ikarita', 'Bâtiment cartographié'],
  'Source version': ['Verisiyo y’amakuru', 'Version de la source'],
  'Building use': ['Icyo inyubako ikoreshwa', 'Usage du bâtiment'],
  'Footprint area': ['Ubuso bw’inyubako', 'Surface de l’emprise'],
  'This marker is a point within the source footprint, not its roof outline.': ['Aka kamenyetso ni akadomo kari mu mbibi z’inyubako zanditswe; si igishushanyo cy’igisenge.', 'Ce marqueur est un point dans l’emprise source, pas le contour du toit.'],
  'Tap a colored building marker to inspect its source, date and use.': ['Kanda ku kamenyetso k’inyubako gafite ibara urebe inkomoko y’amakuru, itariki n’ikoreshwa ryayo.', 'Touchez un marqueur coloré pour voir sa source, sa date et son usage.'],
  'Count mapped buildings': ['Bara inyubako ziri ku ikarita', 'Compter les bâtiments cartographiés'],
  'Select a village or draw an area up to 50 km² to count buildings.': ['Hitamo umudugudu cyangwa ushushanye agace katarenga 50 km² kugira ngo ubare inyubako.', 'Sélectionnez un village ou dessinez une zone de 50 km² maximum pour compter les bâtiments.'],
  'Enable counting, then choose one date or compare two dates below the map.': ['Fungura kubara, hanyuma uhitemo itariki imwe cyangwa ugereranye ebyiri munsi y’ikarita.', 'Activez le comptage, puis choisissez une date ou comparez deux dates sous la carte.'],
  'Use the count switch above and the date controls below the map.': ['Koresha akabuto ko kubara kari hejuru n’amatariki ari munsi y’ikarita.', 'Utilisez le bouton de comptage ci-dessus et les dates sous la carte.'],
  'No source data for this date': ['Nta makuru kuri iyi tariki', 'Aucune donnée pour cette date'],
  'Building counts over time': ['Imibare y’inyubako mu bihe bitandukanye', 'Nombre de bâtiments dans le temps'],
  'Compare counts': ['Gereranya imibare', 'Comparer les nombres'],
  'Date A': ['Itariki A', 'Date A'],
  'Date B': ['Itariki B', 'Date B'],
  'Choose one mapping date, or enable comparison for two dates. Updates apply immediately.': ['Hitamo itariki imwe y’amakuru cyangwa ugereranye ebyiri. Impinduka zihita zigaragara.', 'Choisissez une date de données ou activez la comparaison de deux dates. Mise à jour immédiate.'],
  'Counts use mapped building data, independently of the displayed imagery.': ['Imibare ikoresha inyubako zanditswe ku ikarita, idashingiye ku mashusho agaragara.', 'Les nombres utilisent les bâtiments cartographiés, indépendamment de l’imagerie affichée.'],
  'No mapped structures in this source. A house estimate is unavailable.': ['Nta nyubako zanditse muri aya makuru. Nta kigereranyo cy’amazu kiboneka.', 'Aucune structure cartographiée dans cette source. Estimation des maisons indisponible.'],
  'High-res': ['Ibisobanuro byinshi', 'Haute résolution'],
  'Esri reference imagery · resolution and capture dates vary; no selected-period comparison.': ['Amashusho ya Esri · ibisobanuro n’itariki yafatiweho biratandukanye; ntagereranywa n’igihe wahisemo.', 'Imagerie de référence Esri · résolution et dates variables ; pas de comparaison des périodes sélectionnées.'],
  'Zero mapped structures does not establish zero houses; the source may omit this area.': ['Nta nyubako ziri ku ikarita ntibivuze ko nta mazu ahari; aya makuru ashobora kuba atarimo aka gace.', 'Zéro structure cartographiée ne signifie pas zéro maison ; la source peut omettre cette zone.'],
  'Processing revision': ['Verisiyo yo gutunganya amakuru', 'Version du traitement'],
  'Comparison unavailable: same snapshot, incompatible processing/source, or a date has no data.': ['Kugereranya ntibishoboka: amakuru ni amwe, atunganyijwe mu buryo butandukanye, cyangwa nta makuru kuri imwe mu matariki.', 'Comparaison indisponible : même version, traitements ou sources incompatibles, ou données absentes.'],
  'Export selected area as PNG': ['Bika ifoto y’agace wahisemo nka PNG', 'Exporter la zone sélectionnée en PNG'],
  'Export the selected area, clipped to its shape, as PNG': ['Bika ifoto ya PNG ikurikije ishusho y’agace wahisemo', 'Exporter la zone en PNG découpé selon sa forme'],
  'Select an area to export it': ['Hitamo agace kugira ngo ukabike', 'Sélectionnez une zone à exporter'],
  'Add map center': ['Ongeraho ahagati h’ikarita', 'Ajouter le centre de la carte'],
  'Keyboard: focus the map, pan with arrow keys, then add its center.': ['Koresha mwandikisho: hitamo ikarita, uyimure ukoresheje utwambi, wongereho ahagati yayo.', 'Clavier : activez la carte, déplacez-la avec les flèches, puis ajoutez son centre.'],
  'Draw an area': ['Shushanya agace', 'Dessiner une zone'],
  'Draw a rectangle': ['Shushanya urukiramende', 'Dessiner un rectangle'],
  'Draw a polygon': ['Shushanya ishusho y’agace', 'Dessiner un polygone'],
  'Drawn rectangle': ['Urukiramende washushanyije', 'Rectangle dessiné'],
  'Drawn polygon': ['Agace washushanyije', 'Polygone dessiné'],
  'Drawn area': ['Agace gashushanyije', 'Zone dessinée'],
  'Selection created': ['Itariki agace kashushanyijwe', 'Sélection créée le'],
  'Tap two opposite corners, then Done.': ['Kanda ku mfuruka ebyiri ziteganye, hanyuma urangize.', 'Touchez deux coins opposés, puis Terminer.'],
  'Tap at least three corners, then Done. Up to 64 corners.': ['Kanda ku mfuruka nibura eshatu, hanyuma urangize. Ntarengwa ni 64.', 'Touchez au moins trois coins, puis Terminer. Maximum : 64 coins.'],
  'Pan and zoom between taps. Cancel keeps the previous selection.': ['Ushobora kwimura no kwegeza ikarita. Guhagarika bigumana agace wari wahisemo.', 'Déplacez et zoomez entre les points. Annuler conserve la sélection précédente.'],
  'Undo corner': ['Kuraho imfuruka ya nyuma', 'Retirer le dernier coin'],
  Cancel: ['Hagarika', 'Annuler'],
  Done: ['Rangiza', 'Terminer'],
  'Use a non-crossing area inside Rwanda’s map bounds, up to 50 km². Undo a corner and retry.': ['Shushanya agace kitarenga 50 km² mu mbibi z’ikarita y’u Rwanda, imirongo idahuranya. Kuraho imfuruka wongere ugerageze.', 'Tracez une zone sans croisement dans les limites cartographiques du Rwanda, de 50 km² maximum. Retirez un coin et réessayez.'],
  'User-drawn approximation · not a cadastral boundary.': ['Ni agace washushanyije ugereranyije; si imbibi zemewe z’ubutaka.', 'Tracé approximatif de l’utilisateur ; ce n’est pas une limite cadastrale.'],
  'Copying this link shares the drawn geometry.': ['Gutanga iyi huza bisangiza abandi agace washushanyije.', 'Partager ce lien transmet la géométrie dessinée.'],
  'Candidate acquisitions': ['Amashusho ashoboka yafashwe', 'Acquisitions candidates'],
  'Range applies only to mapped structures; not a total-house estimate.': [
    'Iki kigereranyo kireba iziri ku ikarita gusa, si amazu yose.',
    'Fourchette des structures cartographiées uniquement ; pas une estimation de toutes les maisons.'
  ],
  'Analysis periods': ['Ibihe by’isesengura', 'Périodes d’analyse'],
  'Mapped snapshots at or before the requested dates.': [
    'Amakuru y’ikarita yo kuri izi tariki cyangwa mbere yazo.',
    'Versions cartographiées à ces dates ou avant.'
  ],
  'Mapped buildings': ['Inyubako zanditswe ku ikarita', 'Bâtiments cartographiés'],
  Experimental: ['Biracyageragezwa', 'Expérimental'],
  'Counting mapped buildings…': ['Kubara inyubako ziri ku ikarita…', 'Comptage des bâtiments cartographiés…'],
  'Building analysis unavailable. No count has been estimated.': [
    'Isesengura ry’inyubako ntiribonetse. Nta mubare watanzwe.',
    'Analyse indisponible. Aucun nombre estimé.'
  ],
  'Select a smaller area or try another date.': [
    'Hitamo agace gato cyangwa indi tariki.',
    'Sélectionnez une zone plus petite ou une autre date.'
  ],
  'Low confidence · coverage and residential use unvalidated.': [
    'Icyizere gito · ubwinshi n’ikoreshwa ry’inyubako ntibiragenzurwa.',
    'Confiance faible · couverture et usage résidentiel non validés.'
  ],
  'Mapped structures, not a complete house census.': [
    'Inyubako ziri ku ikarita; si ibarura ry’amazu yose.',
    'Structures cartographiées ; ce n’est pas un recensement complet.'
  ],
  Density: ['Ubucucike', 'Densité'],
  'Tagged houses': ['Izanditswe ko ari amazu', 'Maisons étiquetées'],
  'Other residential': ['Izindi zo guturamo', 'Autres résidentiels'],
  'Unknown use': ['Ikoreshwa ritazwi', 'Usage inconnu'],
  'Non-residential': ['Izitari izo guturamo', 'Non résidentiels'],
  'Possible house structures': ['Inyubako zishobora kuba amazu', 'Structures potentiellement résidentielles'],
  'Experimental range among mapped structures only. Unknown use may include sheds or apartments; not a confidence interval or a total-house estimate.':
    [
      'Iki kigereranyo kireba iziri ku ikarita gusa. Harimo n’izishobora kuba ububiko cyangwa amacumbi menshi. Ntikigaragaza amazu yose.',
      'Fourchette expérimentale des structures cartographiées seulement. Peut inclure dépendances ou immeubles ; ni intervalle de confiance ni estimation de toutes les maisons.'
    ],
  'No building snapshot at or before this date. No estimate available.': [
    'Nta makuru y’inyubako ahari kuri iyi tariki cyangwa mbere yayo. Nta kigereranyo cyatanzwe.',
    'Aucun jeu de données à cette date ou avant. Aucune estimation disponible.'
  ],
  'Data date': ['Itariki y’amakuru', 'Date des données'],
  'Method: count points in mapped building footprints inside the selected polygon; no residential model validated.': [
    'Uburyo: kubara akadomo kari muri buri nyubako iri mu gace wahisemo. Ikoreshwa ry’amazu ntiriragenzurwa.',
    'Méthode : compter un point par empreinte cartographiée dans la zone ; aucun modèle résidentiel validé.'
  ],
  'Mapped dataset change · A minus B': ['Impinduka ku ikarita · A ukuyemo B', 'Évolution des données · A moins B'],
  'Added to selection': ['Izongewemo mu gace', 'Ajouts dans la sélection'],
  'Removed from selection': ['Izavuyemo mu gace', 'Retraits de la sélection'],
  'Mapping edits and improved coverage can change counts. This is not verified construction or demolition.': [
    'Ivugururwa ry’ikarita rihindura imibare. Ntirihamya ko inyubako zubatswe cyangwa zasenywe.',
    'Les corrections et la couverture modifient les comptes. Constructions ou démolitions non vérifiées.'
  ],
  'Comparison unavailable: the same snapshot serves both dates, or a date has no data.': [
    'Kugereranya ntibishoboka: amatariki yombi akoresha amakuru amwe cyangwa nta makuru ahari.',
    'Comparaison indisponible : même version pour les deux dates, ou données absentes.'
  ],
  'Dots are points within footprints, not surveyed locations.': [
    'Utudomo turi mu mbibi z’inyubako; si ibipimo by’abapimyi.',
    'Les points sont situés dans les empreintes ; ce ne sont pas des relevés topographiques.'
  ],
  'Select a village or an area up to 50 km². Counts use dated open mapping snapshots, with low confidence.': [
    'Hitamo umudugudu cyangwa agace katarenga km² 50. Imibare iva ku ikarita ifite itariki; icyizere ni gito.',
    'Choisissez un village ou une zone jusqu’à 50 km². Comptes issus de versions datées, confiance faible.'
  ],
  'Run mapped-building analysis from Layers & tools.': [
    'Tangiza kubara inyubako mu Bikarita n’ibikoresho.',
    'Lancez l’analyse depuis Couches et outils.'
  ],
  'Blue: mapped in A · green: added · red: removed.': [
    'Ubururu: iziri muri A · icyatsi: izongewemo · umutuku: izavuyemo.',
    'Bleu : présents en A · vert : ajouts · rouge : retraits.'
  ],

  'Layers & tools': ['Amakarita n’ibikoresho', 'Couches et outils'],
  'Administrative levels': ['Inzego z’ubuyobozi', 'Niveaux administratifs'],
  'Click to zoom': ['Kanda wegere', 'Cliquer pour zoomer'],
  Basemap: ['Ikarita y’ibanze', 'Fond de carte'],
  'Analysis tools': ['Ibikoresho by’isesengura', 'Outils d’analyse'],
  'Building detection': ['Kubara inyubako', 'Comptage des bâtiments'],
  Soon: ['Birategurwa', 'Bientôt'],
  'Run analysis': ['Tangira isesengura', 'Lancer l’analyse'],
  'Count structures in the current view and plot them on the map.': [
    'Bara inyubako mu gace wahisemo, uzigaragaze ku ikarita.',
    'Compter les bâtiments de la zone sélectionnée et les afficher.'
  ],
  'Search places or coordinates': [
    'Shaka ahantu cyangwa ibipimo by’aho biherereye',
    'Rechercher un lieu ou des coordonnées'
  ],
  'Search a place, or paste lat, lng': ['Shaka ahantu, cyangwa wandike lat, lng', 'Lieu ou coordonnées lat, lng'],
  'No matching places.': ['Nta hantu habonetse.', 'Aucun lieu trouvé.'],
  'GIS Workstation': ['Ikarita y’u Rwanda', 'Carte du Rwanda'],
  'Selection details': ['Amakuru y’ahatoranyijwe', 'Détails de la sélection'],
  Area: ['Ubuso', 'Superficie'],
  Tier: ['Urwego', 'Niveau'],
  'of 5': ['kuri 5', 'sur 5'],
  'Selected point': ['Ahatoranyijwe', 'Point sélectionné'],
  'Outside mapped area': ['Hanze y’ahari ku ikarita', 'Hors de la zone cartographiée'],
  'No administrative boundary at this point.': [
    'Nta mbibi z’ubuyobozi zabonetse hano.',
    'Aucune limite administrative à ce point.'
  ],
  'Building detection results will appear here.': [
    'Ibyavuye mu kubara inyubako bizagaragara hano.',
    'Les résultats du comptage apparaîtront ici.'
  ],
  Copied: ['Byandukuwe', 'Copié'],
  Copy: ['Koporora', 'Copier'],
  'Close inspector': ['Funga amakuru', 'Fermer les détails'],
  'Export card as PNG': ['Bika amakuru nka PNG', 'Exporter la fiche en PNG'],
  'Export current view as PNG': ['Bika ikarita nka PNG', 'Exporter la vue en PNG'],
  'Export selected boundary as PNG': ['Bika agace wahisemo nka PNG', 'Exporter la zone en PNG'],
  'Zoom in': ['Egera', 'Zoom avant'],
  'Zoom out': ['Subira inyuma', 'Zoom arrière'],
  'Reset view to all of Rwanda': ['Erekana u Rwanda rwose', 'Voir tout le Rwanda'],
  'Detect my location': ['Menya aho ndi', 'Me localiser'],
  'Click the map or search to select a place': [
    'Kanda ku ikarita cyangwa ushake ahantu',
    'Cliquez sur la carte ou cherchez un lieu'
  ],
  'Point lies outside mapped boundaries': [
    'Aha hari hanze y’imbibi ziri ku ikarita',
    'Point hors des limites cartographiées'
  ],
  Active: ['Biragaragara', 'Actif'],
  Context: ['Ahakikije', 'Contexte'],
  'Period A': ['Igihe A', 'Période A'],
  'Period B': ['Igihe B', 'Période B'],
  'Compare periods': ['Gereranya ibihe', 'Comparer les périodes'],
  'Swipe comparison': ['Gereranya ukurura', 'Balayer la comparaison'],
  Start: ['Guhera', 'Début'],
  End: ['Kugeza', 'Fin'],
  'Apply periods': ['Emeza ibihe', 'Appliquer les périodes'],
  'Same season last year': ['Igihe nk’iki umwaka ushize', 'Même saison, année précédente'],
  '10 m native imagery · least-cloudy scenes; clouds may remain.': [
    'Amashusho ya metero 10 · ibicu bike; bishobora gusigara.',
    'Images natives à 10 m · scènes moins nuageuses ; nuages possibles.'
  ],
  'Scene cloud cover': ['Ibicu mu ishusho yose', 'Nébulosité de la scène'],
  Acquired: ['Byafashwe', 'Acquisition'],
  'Loading imagery metadata…': ['Amakuru y’amashusho arimo kuboneka…', 'Chargement des métadonnées…'],
  'No scenes found for this period.': ['Nta mashusho yabonetse muri iki gihe.', 'Aucune scène pour cette période.'],
  'Imagery unavailable. The street reference remains visible.': [
    'Amashusho ntabonetse. Ikarita y’imihanda iracyagaragara.',
    'Images indisponibles. Le fond routier reste visible.'
  ],
  'Reference only · 2016 imagery': ['Amashusho ya 2016 gusa', 'Référence uniquement · images de 2016'],
  'Rolling reference · no historical tile dates': [
    'Ikarita ihora ivugururwa · nta tariki z’amashusho',
    'Fond actualisé · sans dates historiques'
  ],
  'Source date unknown · reference boundaries, not cadastral data.': [
    'Itariki y’inkomoko ntizwi · imbibi z’ubuyobozi, si iza parcelle.',
    'Date source inconnue · limites de référence, non cadastrales.'
  ],
  'Confidence: local cloud-free coverage unvalidated.': [
    'Icyizere: ibicu by’aha ntibiragenzurwa.',
    'Confiance : absence locale de nuages non validée.'
  ],
  'Check dates: 2019–today, up to 93 days per period.': [
    'Reba amatariki: kuva 2019 kugeza ubu, iminsi itarenze 93.',
    'Vérifiez les dates : 2019 à aujourd’hui, 93 jours maximum.'
  ],
  'Candidate scenes in view; scene clouds are not local cloud cover.': [
    'Amashusho ashoboka aha; ibicu ni iby’ishusho yose.',
    'Scènes candidates visibles ; nébulosité globale, non locale.'
  ],
  'Image export failed. Please retry.': ['Kubika ishusho byanze. Ongera ugerageze.', 'Échec de l’export. Réessayez.'],
  Province: ['Intara', 'Province'],
  District: ['Akarere', 'District'],
  Sector: ['Umurenge', 'Secteur'],
  Cell: ['Akagari', 'Cellule'],
  Village: ['Umudugudu', 'Village'],
  'Sentinel-2 · dated scenes': ['Sentinel-2 · amashusho afite amatariki', 'Sentinel-2 · scènes datées'],
  'Sentinel-2 · 2016 reference': ['Sentinel-2 · amashusho ya 2016', 'Sentinel-2 · référence 2016'],
  Satellite: ['Icyogajuru', 'Satellite'],
  Reference: ['Ikarita yifashishwa', 'Référence'],
  Close: ['Funga', 'Fermer'],
  'Show acquisition details': ['Erekana amakuru y’amashusho', 'Afficher les acquisitions']
};
export function translate(text: string, language: Language): string {
  return language === 'en' ? text : (messages[text]?.[language === 'rw' ? 0 : 1] ?? text);
}
interface I18n {
  language: Language;
  setLanguage: (l: Language) => void;
  t: (text: string) => string;
}
const Context = createContext<I18n>({ language: 'rw', setLanguage: () => {}, t: (text) => translate(text, 'rw') });
export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem('rwanda-map-language');
    } catch {}
    const l = typeof window === 'undefined' ? 'rw' : (new URLSearchParams(window.location.search).get('lang') ?? saved);
    return l === 'en' || l === 'fr' ? l : 'rw';
  });
  useEffect(() => {
    document.documentElement.lang = language;
    try {
      localStorage.setItem('rwanda-map-language', language);
    } catch {}
  }, [language]);
  return (
    <Context.Provider value={{ language, setLanguage, t: (text) => translate(text, language) }}>
      {children}
    </Context.Provider>
  );
}
export function useI18n() {
  return useContext(Context);
}
