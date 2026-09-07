// Découpage d'une vidéo publicitaire, entièrement dans le navigateur.
//
// Deux sorties :
//   - des images clés, échantillonnées régulièrement, avec une rafale sur
//     la fin (c'est là que se trouve la carte de fin, donc les promesses) ;
//   - la piste audio en WAV 16 kHz mono, seul format à la fois léger et
//     accepté partout pour la transcription.
//
// Rien de tout ça ne passe par un serveur : ni ffmpeg, ni transcodage.
// L'élément <video> fait le décodage, WebAudio fait le rééchantillonnage.

export interface ImageExtraite {
  blob: Blob;
  /** Position dans la vidéo, en secondes. */
  timecode: number;
}

export interface OptionsExtraction {
  /** Intervalle entre deux images, en secondes. */
  pas?: number;
  /** Durée de fin échantillonnée seconde par seconde. */
  finDense?: number;
  /** Nombre maximum d'images produites. */
  maximum?: number;
  /** Largeur des images produites. */
  largeur?: number;
}

/** Positions à capturer : régulières, puis resserrées sur la fin. */
function positions(duree: number, o: Required<OptionsExtraction>): number[] {
  const liste = new Set<number>();
  liste.add(0.4);
  for (let t = o.pas; t < duree - o.finDense; t += o.pas) liste.add(Math.round(t * 10) / 10);
  const debutFin = Math.max(0, duree - o.finDense);
  for (let t = debutFin; t < duree; t += 1) liste.add(Math.round(t * 10) / 10);
  liste.add(Math.max(0, duree - 0.3));

  const triees = [...liste].sort((a, b) => a - b);
  if (triees.length <= o.maximum) return triees;

  // Trop d'images : on garde la fin entière et on éclaircit le début.
  const aGarder = triees.filter((t) => t >= debutFin);
  const debut = triees.filter((t) => t < debutFin);
  const reste = o.maximum - aGarder.length;
  const facteur = Math.max(1, Math.ceil(debut.length / Math.max(1, reste)));
  return [...debut.filter((_, i) => i % facteur === 0).slice(0, reste), ...aGarder];
}

export async function extraireImages(
  fichier: File,
  options: OptionsExtraction = {},
  surAvancement?: (fait: number, total: number) => void,
): Promise<{ images: ImageExtraite[]; duree: number }> {
  const o: Required<OptionsExtraction> = {
    pas: options.pas ?? 2.5,
    finDense: options.finDense ?? 5,
    maximum: options.maximum ?? 28,
    largeur: options.largeur ?? 512,
  };

  const source = URL.createObjectURL(fichier);
  const video = document.createElement('video');
  video.src = source;
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';

  try {
    await new Promise<void>((resoudre, rejeter) => {
      video.onloadedmetadata = () => resoudre();
      video.onerror = () => rejeter(new Error('Vidéo illisible par le navigateur.'));
    });

    const duree = video.duration;
    if (!Number.isFinite(duree) || duree <= 0) throw new Error('Durée de la vidéo introuvable.');

    const echelle = o.largeur / video.videoWidth;
    const toile = document.createElement('canvas');
    toile.width = o.largeur;
    toile.height = Math.round(video.videoHeight * echelle);
    const pinceau = toile.getContext('2d');
    if (!pinceau) throw new Error('Canvas indisponible.');

    const cibles = positions(duree, o);
    const images: ImageExtraite[] = [];

    for (const [index, timecode] of cibles.entries()) {
      await new Promise<void>((resoudre) => {
        const fait = () => { video.onseeked = null; resoudre(); };
        video.onseeked = fait;
        video.currentTime = Math.min(timecode, duree - 0.05);
        // Certains navigateurs n'émettent pas « seeked » si on est déjà là.
        window.setTimeout(fait, 3000);
      });

      pinceau.drawImage(video, 0, 0, toile.width, toile.height);
      const blob = await new Promise<Blob | null>((r) => toile.toBlob(r, 'image/jpeg', 0.72));
      if (blob) images.push({ blob, timecode });
      surAvancement?.(index + 1, cibles.length);
    }

    return { images, duree };
  } finally {
    URL.revokeObjectURL(source);
    video.removeAttribute('src');
  }
}

// ------------------------------------------------------------------ audio

const FREQUENCE = 16000;

/** Piste audio en WAV 16 kHz mono. Une minute pèse environ 2 Mo. */
export async function extraireAudio(fichier: File): Promise<Blob> {
  const octets = await fichier.arrayBuffer();

  const Contexte = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const contexte = new Contexte();
  let decode: AudioBuffer;
  try {
    decode = await contexte.decodeAudioData(octets.slice(0));
  } finally {
    void contexte.close();
  }

  const horsEcran = new OfflineAudioContext(1, Math.ceil(decode.duration * FREQUENCE), FREQUENCE);
  const lecteur = horsEcran.createBufferSource();
  lecteur.buffer = decode;
  lecteur.connect(horsEcran.destination);
  lecteur.start();
  const mono = await horsEcran.startRendering();

  return encoderWav(mono.getChannelData(0), FREQUENCE);
}

function encoderWav(echantillons: Float32Array, frequence: number): Blob {
  const tampon = new ArrayBuffer(44 + echantillons.length * 2);
  const vue = new DataView(tampon);

  const texte = (position: number, valeur: string) => {
    for (let i = 0; i < valeur.length; i += 1) vue.setUint8(position + i, valeur.charCodeAt(i));
  };

  texte(0, 'RIFF');
  vue.setUint32(4, 36 + echantillons.length * 2, true);
  texte(8, 'WAVE');
  texte(12, 'fmt ');
  vue.setUint32(16, 16, true);
  vue.setUint16(20, 1, true);          // PCM
  vue.setUint16(22, 1, true);          // mono
  vue.setUint32(24, frequence, true);
  vue.setUint32(28, frequence * 2, true);
  vue.setUint16(32, 2, true);
  vue.setUint16(34, 16, true);
  texte(36, 'data');
  vue.setUint32(40, echantillons.length * 2, true);

  let position = 44;
  for (let i = 0; i < echantillons.length; i += 1) {
    const valeur = Math.max(-1, Math.min(1, echantillons[i]));
    vue.setInt16(position, valeur < 0 ? valeur * 0x8000 : valeur * 0x7fff, true);
    position += 2;
  }

  return new Blob([tampon], { type: 'audio/wav' });
}

/** Reconnaît une vidéo à son type MIME ou, à défaut, à son extension. */
export function estUneVideo(fichier: File): boolean {
  if (fichier.type.startsWith('video/')) return true;
  return /\.(mp4|mov|m4v|webm|avi|mkv)$/i.test(fichier.name);
}

/** « Copie_de_2057_1_VD_UGC_Facecam.mp4 » → concept 2057, variante 1.
 *  Les fichiers qui partagent le même concept sont des déclinaisons d'une
 *  même pub, pas des pubs différentes. */
export function lireNomFichier(nom: string): { concept: string | null; variante: string | null; reference: string } {
  const sansExtension = nom.replace(/\.[^.]+$/, '');
  const nettoye = sansExtension.replace(/^(?:copie[\s_-]*de[\s_-]*|copy[\s_-]*of[\s_-]*)/i, '');
  const trouve = /^(\d{2,6})[_-](\d{1,3})(?!\d)/.exec(nettoye);
  if (!trouve) return { concept: null, variante: null, reference: nettoye.replace(/[_-]+/g, ' ').trim() };
  return {
    concept: trouve[1],
    variante: trouve[2],
    reference: `${trouve[1]}-${trouve[2]}`,
  };
}
