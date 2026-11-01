import fs from 'node:fs';
import path from 'node:path';
import {
  AudioClip,
  TrackLayerGroup,
  createAudioLayoutManifest,
  parseAudioFileMetadata,
  type AudioFileLayoutObservation,
  type BlueData,
} from '@blue/data';

/** Inspect source headers without changing authored paths or cached channel counts. */
export function prepareCliAudioLayout(project: BlueData, projectDirectory: string) {
  if (!project.getMixer().isPanningEnabled()) return undefined;
  const observations = new Map<string, AudioFileLayoutObservation>();
  for (const group of project.getScore()) {
    if (!(group instanceof TrackLayerGroup)) continue;
    for (const track of group) {
      for (const item of track) {
        if (!(item instanceof AudioClip)) continue;
        const filename = item.getAudioFile();
        if (observations.has(filename)) continue;
        const local = path.resolve(projectDirectory, filename);
        const source = fs.existsSync(local) ? local : filename;
        let metadata;
        try {
          const file = fs.openSync(source, 'r');
          try {
            const header = Buffer.alloc(Math.min(fs.fstatSync(file).size, 65536));
            fs.readSync(file, header, 0, header.length, 0);
            metadata = parseAudioFileMetadata(header);
          } finally {
            fs.closeSync(file);
          }
        } catch (error) {
          throw new Error('Cannot inspect audio file ' + filename + ': ' + String(error));
        }
        if (metadata.channels !== 1 && metadata.channels !== 2) {
          throw new Error(
            'Unsupported audio channel count for ' + filename + ': ' + metadata.channels,
          );
        }
        observations.set(filename, {
          filePath: filename,
          channels: metadata.channels,
          status: 'verified',
          sampleRate: metadata.sampleRate,
          duration: metadata.durationSeconds,
        });
      }
    }
  }
  return createAudioLayoutManifest(observations);
}
