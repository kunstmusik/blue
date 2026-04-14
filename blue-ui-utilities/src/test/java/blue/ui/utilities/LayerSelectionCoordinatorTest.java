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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import org.junit.jupiter.api.Test;

class LayerSelectionCoordinatorTest {

    @Test
    void clearsAnchorWhenAnchorSelectionIsClearedLocally() {
        LayerSelectionCoordinator coordinator = new LayerSelectionCoordinator();
        StubProvider provider = new StubProvider(8);

        provider.setCoordinator(coordinator);
        coordinator.addProvider(provider);

        provider.getSelectionModel().setAnchor(3);
        assertSame(provider, coordinator.getAnchorProvider());

        provider.getSelectionModel().clear();

        assertNull(coordinator.getAnchorProvider());
    }

    @Test
    void usesTrueAnchorForCrossGroupShiftWhenAnchorGroupIsAboveTarget() {
        LayerSelectionCoordinator coordinator = new LayerSelectionCoordinator();
        StubProvider anchorProvider = new StubProvider(8);
        StubProvider targetProvider = new StubProvider(6);

        anchorProvider.setCoordinator(coordinator);
        targetProvider.setCoordinator(coordinator);
        coordinator.addProvider(anchorProvider);
        coordinator.addProvider(targetProvider);

        anchorProvider.getSelectionModel().setAnchor(5);
        anchorProvider.getSelectionModel().setEnd(3);

        coordinator.handleCrossGroupShiftClick(targetProvider, 2);

        assertSame(anchorProvider, coordinator.getAnchorProvider());
        assertEquals(5, anchorProvider.getSelectionModel().getAnchorIndex());
        assertEquals(5, anchorProvider.getSelectionModel().getStartIndex());
        assertEquals(7, anchorProvider.getSelectionModel().getEndIndex());
        assertEquals(0, targetProvider.getSelectionModel().getStartIndex());
        assertEquals(2, targetProvider.getSelectionModel().getEndIndex());
    }

    @Test
    void preservesTrueAnchorForCrossGroupShiftWhenAnchorGroupIsBelowTarget() {
        LayerSelectionCoordinator coordinator = new LayerSelectionCoordinator();
        StubProvider targetProvider = new StubProvider(6);
        StubProvider anchorProvider = new StubProvider(8);

        targetProvider.setCoordinator(coordinator);
        anchorProvider.setCoordinator(coordinator);
        coordinator.addProvider(targetProvider);
        coordinator.addProvider(anchorProvider);

        anchorProvider.getSelectionModel().setAnchor(4);
        anchorProvider.getSelectionModel().setEnd(2);

        coordinator.handleCrossGroupShiftClick(targetProvider, 1);

        assertSame(anchorProvider, coordinator.getAnchorProvider());
        assertEquals(4, anchorProvider.getSelectionModel().getAnchorIndex());
        assertEquals(0, anchorProvider.getSelectionModel().getStartIndex());
        assertEquals(4, anchorProvider.getSelectionModel().getEndIndex());
        assertEquals(1, targetProvider.getSelectionModel().getStartIndex());
        assertEquals(5, targetProvider.getSelectionModel().getEndIndex());
    }

    @Test
    void clearsAnchorWhenAnchorProviderIsRemoved() {
        LayerSelectionCoordinator coordinator = new LayerSelectionCoordinator();
        StubProvider provider = new StubProvider(8);

        provider.setCoordinator(coordinator);
        coordinator.addProvider(provider);

        provider.getSelectionModel().setAnchor(2);
        assertSame(provider, coordinator.getAnchorProvider());

        coordinator.removeProvider(provider);

        assertNull(coordinator.getAnchorProvider());
        assertNull(provider.getCoordinator());
    }

    @Test
    void removedProviderCannotReanchorCoordinator() {
        LayerSelectionCoordinator coordinator = new LayerSelectionCoordinator();
        StubProvider removedProvider = new StubProvider(8);
        StubProvider activeProvider = new StubProvider(8);

        removedProvider.setCoordinator(coordinator);
        activeProvider.setCoordinator(coordinator);
        coordinator.addProvider(removedProvider);
        coordinator.addProvider(activeProvider);

        removedProvider.getSelectionModel().setAnchor(2);
        coordinator.removeProvider(removedProvider);

        removedProvider.getSelectionModel().setAnchor(4);
        activeProvider.getSelectionModel().setAnchor(1);

        assertSame(activeProvider, coordinator.getAnchorProvider());
    }

    private static final class StubProvider implements LayerSelectionProvider {

        private final SelectionModel selectionModel = new SelectionModel();
        private final int layerCount;
        private LayerSelectionCoordinator coordinator;

        private StubProvider(int layerCount) {
            this.layerCount = layerCount;
        }

        @Override
        public SelectionModel getSelectionModel() {
            return selectionModel;
        }

        @Override
        public int getLayerCount() {
            return layerCount;
        }

        @Override
        public void setCoordinator(LayerSelectionCoordinator coordinator) {
            this.coordinator = coordinator;
        }

        @Override
        public LayerSelectionCoordinator getCoordinator() {
            return coordinator;
        }
    }
}
