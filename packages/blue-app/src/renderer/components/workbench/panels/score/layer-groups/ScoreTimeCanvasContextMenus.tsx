import * as ContextMenu from '@radix-ui/react-context-menu';
import { ChevronRight } from 'lucide-react';
import type { PolyObjectLayerGroupSnapshot } from '../types';
import type { ScoreObjectClipboardEntry } from '../../../../../stores/score-selection-store';
import {
  PopoutContextMenuPortal,
  portalEventIsolationProps,
} from '../../../../../hooks/host-portals';
import { cn } from '../../../../../lib/cn';
import type { ScorePasteObject } from './score-clipboard-utils';

const DEFAULT_SOBJ_DURATION = 4.0;

export function ObjectContextMenu({
  menuItemClass,
  subMenuClass,
  sepClass,
  onAlignLeft,
  onAlignCenter,
  onAlignRight,
  onCopy,
  onCut,
  onAddToProjectSoundObjectLibrary,
  canAddToProjectSoundObjectLibrary,
  onRemove,
  onFollowTheLeader,
  onReverse,
  onShift,
  onSetColor,
  onSetToLayerColor,
  onSetSubjectiveToObjective,
  canSetObjectiveDuration,
  onReplaceWithBuffer,
  canReplaceWithBuffer,
  onFreezeUnfreeze,
  onExport,
  canExport,
  onConvertToObjectBuilder,
  canConvertToObjectBuilder,
  onConvertToPolyObject,
  canConvertToPolyObject,
}: {
  menuItemClass: string;
  subMenuClass: string;
  sepClass: string;
  onAlignLeft: () => void;
  onAlignCenter: () => void;
  onAlignRight: () => void;
  onCopy: () => void;
  onCut: () => void;
  onAddToProjectSoundObjectLibrary: () => void;
  canAddToProjectSoundObjectLibrary: boolean;
  onRemove: () => void;
  onFollowTheLeader: () => void;
  onReverse: () => void;
  onShift: () => void;
  onSetColor: () => void;
  onSetToLayerColor: () => void;
  onSetSubjectiveToObjective: () => void;
  canSetObjectiveDuration: boolean;
  onReplaceWithBuffer: () => void;
  canReplaceWithBuffer: boolean;
  onFreezeUnfreeze: () => void;
  onExport: () => void;
  canExport: boolean;
  onConvertToObjectBuilder: () => void;
  canConvertToObjectBuilder: boolean;
  onConvertToPolyObject: () => void;
  canConvertToPolyObject: boolean;
}) {
  return (
    <>
      <ContextMenu.Item
        className={menuItemClass}
        disabled={!canAddToProjectSoundObjectLibrary}
        onSelect={onAddToProjectSoundObjectLibrary}
      >
        Add to Project SoundObjects
      </ContextMenu.Item>
      <ContextMenu.Separator className={sepClass} />
      <ContextMenu.Item className={menuItemClass} onSelect={onFreezeUnfreeze}>
        Freeze/Unfreeze ScoreObjects
      </ContextMenu.Item>
      <ContextMenu.Separator className={sepClass} />
      <ContextMenu.Item
        className={menuItemClass}
        disabled={!canConvertToPolyObject}
        onSelect={onConvertToPolyObject}
      >
        Convert to PolyObject
      </ContextMenu.Item>
      <ContextMenu.Item
        className={menuItemClass}
        disabled={!canConvertToObjectBuilder}
        onSelect={onConvertToObjectBuilder}
      >
        Convert to ObjectBuilder
      </ContextMenu.Item>
      <ContextMenu.Item
        className={menuItemClass}
        disabled={!canReplaceWithBuffer}
        onSelect={onReplaceWithBuffer}
      >
        Replace with SoundObject in Buffer
      </ContextMenu.Item>
      <ContextMenu.Separator className={sepClass} />
      <ContextMenu.Item className={menuItemClass} onSelect={onFollowTheLeader}>
        Follow the Leader
      </ContextMenu.Item>
      <ContextMenu.Item className={menuItemClass} onSelect={onReverse}>
        Reverse
      </ContextMenu.Item>
      <ContextMenu.Sub>
        <ContextMenu.SubTrigger className={cn(menuItemClass, 'editor-context-menu__subtrigger')}>
          <span>Align</span>
          <ChevronRight className="w-3.5 h-3.5 opacity-60" />
        </ContextMenu.SubTrigger>
        <PopoutContextMenuPortal>
          <ContextMenu.SubContent className={subMenuClass} {...portalEventIsolationProps}>
            <ContextMenu.Item className={menuItemClass} onSelect={onAlignLeft}>
              Align Left
            </ContextMenu.Item>
            <ContextMenu.Item className={menuItemClass} onSelect={onAlignCenter}>
              Align Center
            </ContextMenu.Item>
            <ContextMenu.Item className={menuItemClass} onSelect={onAlignRight}>
              Align Right
            </ContextMenu.Item>
          </ContextMenu.SubContent>
        </PopoutContextMenuPortal>
      </ContextMenu.Sub>
      <ContextMenu.Item className={menuItemClass} onSelect={onShift}>
        Shift…
      </ContextMenu.Item>
      <ContextMenu.Item
        className={menuItemClass}
        disabled={!canSetObjectiveDuration}
        onSelect={onSetSubjectiveToObjective}
      >
        Set Subjective Time to Objective Time
      </ContextMenu.Item>
      <ContextMenu.Separator className={sepClass} />
      <ContextMenu.Item className={menuItemClass} onSelect={onCut}>
        Cut<span className="float-right text-blue-muted text-role-callout ml-4">⌘X</span>
      </ContextMenu.Item>
      <ContextMenu.Item className={menuItemClass} onSelect={onCopy}>
        Copy<span className="float-right text-blue-muted text-role-callout ml-4">⌘C</span>
      </ContextMenu.Item>
      <ContextMenu.Separator className={sepClass} />
      <ContextMenu.Item className={menuItemClass} onSelect={onRemove}>
        Remove<span className="float-right text-blue-muted text-role-callout ml-4">Del</span>
      </ContextMenu.Item>
      <ContextMenu.Separator className={sepClass} />
      <ContextMenu.Item className={menuItemClass} onSelect={onSetColor}>
        Set Color…
      </ContextMenu.Item>
      <ContextMenu.Item className={menuItemClass} onSelect={onSetToLayerColor}>
        Set to Layer Color
      </ContextMenu.Item>
      <ContextMenu.Separator className={sepClass} />
      <ContextMenu.Item className={menuItemClass} disabled={!canExport} onSelect={onExport}>
        Export…
      </ContextMenu.Item>
    </>
  );
}

export function EmptyAreaContextMenu({
  menuItemClass,
  sepClass,
  clipboard,
  libraryClipboardAvailable,
  libraryBsbAvailable,
  contextMenuPos,
  group,
  onPaste,
  onPasteAsPolyObject,
  onLibraryPaste,
  onPasteBsb,
  snapBeatValue,
  addScoreObjects,
  onSelectLayer,
  onSelectAllBefore,
  onSelectAllAfter,
  onImport,
}: {
  menuItemClass: string;
  sepClass: string;
  clipboard: ScoreObjectClipboardEntry[];
  libraryClipboardAvailable: boolean;
  libraryBsbAvailable: boolean;
  contextMenuPos: { xBeats: number; layerIndex: number } | null;
  group: PolyObjectLayerGroupSnapshot;
  onPaste: () => void;
  onPasteAsPolyObject: () => void;
  onLibraryPaste: () => void;
  onPasteBsb: () => void;
  snapBeatValue: (b: number) => number;
  addScoreObjects: (objects: ScorePasteObject[]) => void;
  onSelectLayer: () => void;
  onSelectAllBefore: () => void;
  onSelectAllAfter: () => void;
  onImport: () => void;
}) {
  const handleAddSobj = (typeName: string) => {
    if (contextMenuPos == null) return;
    const isContainer = typeName === 'PolyObject';
    addScoreObjects([
      {
        layerIndex: contextMenuPos.layerIndex,
        groupId: group.groupId,
        name: typeName,
        startBeats: snapBeatValue(contextMenuPos.xBeats),
        durationBeats: DEFAULT_SOBJ_DURATION,
        objectType: typeName,
        isContainer,
      },
    ]);
  };

  const addSobjTypes = [
    { name: 'AudioFile', pos: 10 },
    { name: 'Comment', pos: 20 },
    { name: 'External', pos: 30 },
    { name: 'GenericScore', pos: 40 },
    { name: 'JMask', pos: 50 },
    { name: 'LineObject', pos: 60 },
    { name: 'ObjectBuilder', pos: 70 },
    { name: 'PatternObject', pos: 80 },
    { name: 'PianoRoll', pos: 90 },
    { name: 'PolyObject', pos: 100 },
    { name: 'PythonObject', pos: 110 },
    { name: 'JavaScriptObject', pos: 120 },
    { name: 'Sound', pos: 130 },
    { name: 'TrackerObject', pos: 140 },
    { name: 'ZakLineObject', pos: 150 },
  ];

  return (
    <>
      <ContextMenu.Sub>
        <ContextMenu.SubTrigger className={cn(menuItemClass, 'editor-context-menu__subtrigger')}>
          <span>Add SoundObject</span>
          <ChevronRight className="w-3.5 h-3.5 opacity-60" />
        </ContextMenu.SubTrigger>
        <PopoutContextMenuPortal>
          <ContextMenu.SubContent className="editor-context-menu" {...portalEventIsolationProps}>
            {addSobjTypes.map((t) => (
              <ContextMenu.Item
                key={t.name}
                className={menuItemClass}
                onSelect={() => handleAddSobj(t.name)}
              >
                {t.name}
              </ContextMenu.Item>
            ))}
          </ContextMenu.SubContent>
        </PopoutContextMenuPortal>
      </ContextMenu.Sub>
      <ContextMenu.Separator className={sepClass} />
      {(libraryClipboardAvailable || libraryBsbAvailable || clipboard.length > 0) && (
        <>
          <ContextMenu.Item
            className={menuItemClass}
            disabled={!libraryClipboardAvailable && clipboard.length === 0}
            onSelect={libraryClipboardAvailable ? onLibraryPaste : onPaste}
          >
            Paste<span className="float-right text-blue-muted text-role-callout ml-4">⌘V</span>
          </ContextMenu.Item>
          {clipboard.length > 0 && (
            <ContextMenu.Item
              className={menuItemClass}
              disabled={clipboard.some((entry) => entry.objectType === 'AudioClip')}
              onSelect={onPasteAsPolyObject}
            >
              Paste as PolyObject
            </ContextMenu.Item>
          )}
          <ContextMenu.Item
            className={menuItemClass}
            disabled={!libraryBsbAvailable}
            onSelect={onPasteBsb}
          >
            Paste BSB As Sound
          </ContextMenu.Item>
          <ContextMenu.Separator className={sepClass} />
        </>
      )}
      <ContextMenu.Item
        className={menuItemClass}
        disabled={!contextMenuPos}
        onSelect={onSelectLayer}
      >
        Select Layer
      </ContextMenu.Item>
      <ContextMenu.Item
        className={menuItemClass}
        disabled={!contextMenuPos}
        onSelect={onSelectAllBefore}
      >
        Select All Before
      </ContextMenu.Item>
      <ContextMenu.Item
        className={menuItemClass}
        disabled={!contextMenuPos}
        onSelect={onSelectAllAfter}
      >
        Select All After
      </ContextMenu.Item>
      <ContextMenu.Separator className={sepClass} />
      <ContextMenu.Item className={menuItemClass} onSelect={onImport}>
        Import…
      </ContextMenu.Item>
    </>
  );
}
