/*
 * blue - object composition environment for csound
 * Copyright (C) 2026
 * Steven Yi <stevenyi@gmail.com>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.
 */
package blue.ui.utilities;

import java.util.ArrayList;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Map;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;

/**
 * Coordinates layer selection across multiple LayerSelectionProvider panels.
 * When selection changes in one panel, other panels are cleared.
 * Supports cross-group shift-click selection.
 *
 * @author stevenyi
 */
public class LayerSelectionCoordinator {

    private final List<LayerSelectionProvider> providers = new ArrayList<>();
    private final Map<LayerSelectionProvider, ChangeListener> selectionListeners
            = new IdentityHashMap<>();
    private boolean updating = false;
    private LayerSelectionProvider anchorProvider = null;

    private final List<ChangeListener> crossGroupListeners = new ArrayList<>();

    public void addProvider(LayerSelectionProvider provider) {
        ChangeListener existingListener = selectionListeners.remove(provider);
        if (existingListener != null) {
            provider.getSelectionModel().removeChangeListener(existingListener);
            providers.remove(provider);
        }

        providers.add(provider);
        ChangeListener listener = e -> {
            onSelectionChanged(provider);
        };
        selectionListeners.put(provider, listener);
        provider.getSelectionModel().addChangeListener(listener);
    }

    public void removeProvider(LayerSelectionProvider provider) {
        providers.remove(provider);
        ChangeListener listener = selectionListeners.remove(provider);
        if (listener != null) {
            provider.getSelectionModel().removeChangeListener(listener);
        }
        if (provider.getCoordinator() == this) {
            provider.setCoordinator(null);
        }
        if (anchorProvider == provider) {
            anchorProvider = null;
        }
    }

    public void clearProviders() {
        for (LayerSelectionProvider provider : providers) {
            ChangeListener listener = selectionListeners.remove(provider);
            if (listener != null) {
                provider.getSelectionModel().removeChangeListener(listener);
            }
            if (provider.getCoordinator() == this) {
                provider.setCoordinator(null);
            }
        }
        providers.clear();
        anchorProvider = null;
    }

    /**
     * Called when a normal (non-shift) click happens in a provider.
     * Sets the anchor provider and clears all other selections.
     */
    public void setAnchorProvider(LayerSelectionProvider provider) {
        this.anchorProvider = provider;
    }

    public LayerSelectionProvider getAnchorProvider() {
        return anchorProvider;
    }

    /**
     * Handle shift-click in a target provider when the anchor is in a different
     * provider. Selects all layers from the anchor provider through the target
     * provider.
     *
     * @param targetProvider the provider where the shift-click occurred
     * @param targetIndex the layer index within the target provider
     */
    public void handleCrossGroupShiftClick(LayerSelectionProvider targetProvider, int targetIndex) {
        if (anchorProvider == null || anchorProvider == targetProvider) {
            return;
        }

        SelectionModel anchorSelection = anchorProvider.getSelectionModel();
        int anchorSelectionIndex = anchorSelection.getAnchorIndex();
        if (anchorSelectionIndex < 0) {
            anchorProvider = null;
            return;
        }

        int anchorIdx = providers.indexOf(anchorProvider);
        int targetIdx = providers.indexOf(targetProvider);

        if (anchorIdx < 0 || targetIdx < 0) {
            anchorProvider = null;
            return;
        }

        updating = true;
        try {
            int startGroupIdx = Math.min(anchorIdx, targetIdx);
            int endGroupIdx = Math.max(anchorIdx, targetIdx);

            for (int i = 0; i < providers.size(); i++) {
                LayerSelectionProvider p = providers.get(i);
                SelectionModel sm = p.getSelectionModel();

                if (i < startGroupIdx || i > endGroupIdx) {
                    sm.clear();
                } else if (i == anchorIdx && i == startGroupIdx) {
                    // Anchor is above target: select from anchor to end
                    sm.setAnchor(anchorSelectionIndex);
                    sm.setEnd(p.getLayerCount() - 1);
                } else if (i == anchorIdx && i == endGroupIdx) {
                    // Anchor is below target: select from 0 to anchor
                    sm.setAnchor(anchorSelectionIndex);
                    sm.setEnd(0);
                } else if (i == targetIdx && i == startGroupIdx) {
                    // Target is above anchor: select from targetIndex to end
                    sm.setAnchor(targetIndex);
                    sm.setEnd(p.getLayerCount() - 1);
                } else if (i == targetIdx && i == endGroupIdx) {
                    // Target is below anchor: select from 0 to targetIndex
                    sm.setAnchor(0);
                    sm.setEnd(targetIndex);
                } else {
                    // Intermediate group: select all
                    sm.setAnchor(0);
                    sm.setEnd(p.getLayerCount() - 1);
                }
            }
        } finally {
            updating = false;
        }
        fireCrossGroupSelectionChanged();
    }

    /**
     * Returns true if layers are selected across multiple groups.
     */
    public boolean isMultiGroupSelected() {
        int count = 0;
        for (LayerSelectionProvider p : providers) {
            if (p.getSelectionModel().getStartIndex() >= 0) {
                count++;
                if (count > 1) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Returns the list of providers that have active selections.
     */
    public List<LayerSelectionProvider> getSelectedProviders() {
        List<LayerSelectionProvider> result = new ArrayList<>();
        for (LayerSelectionProvider p : providers) {
            if (p.getSelectionModel().getStartIndex() >= 0) {
                result.add(p);
            }
        }
        return result;
    }

    public List<LayerSelectionProvider> getProviders() {
        return providers;
    }

    public void clearSelections() {
        updating = true;
        try {
            for (LayerSelectionProvider p : providers) {
                p.getSelectionModel().clear();
            }
        } finally {
            updating = false;
        }
        anchorProvider = null;
        fireCrossGroupSelectionChanged();
    }

    private void onSelectionChanged(LayerSelectionProvider source) {
        if (updating) {
            return;
        }

        SelectionModel sm = source.getSelectionModel();
        if (sm.getStartIndex() >= 0) {
            // A valid selection was made in source — clear others
            updating = true;
            try {
                for (LayerSelectionProvider p : providers) {
                    if (p != source) {
                        p.getSelectionModel().clear();
                    }
                }
            } finally {
                updating = false;
            }
            anchorProvider = source;
        } else if (anchorProvider == source) {
            anchorProvider = null;
        }
    }

    public void addCrossGroupSelectionListener(ChangeListener listener) {
        crossGroupListeners.add(listener);
    }

    public void removeCrossGroupSelectionListener(ChangeListener listener) {
        crossGroupListeners.remove(listener);
    }

    private void fireCrossGroupSelectionChanged() {
        ChangeEvent e = new ChangeEvent(this);
        for (ChangeListener listener : crossGroupListeners) {
            listener.stateChanged(e);
        }
    }
}
