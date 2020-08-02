/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2006 Steven Yi (stevenyi@gmail.com)
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published
 * by  the Free Software Foundation; either version 2 of the License or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB.  If not, write to
 * the Free Software Foundation Inc., 59 Temple Place - Suite 330,
 * Boston, MA  02111-1307 USA
 */
package blue.ui.core.mixer;

import blue.BlueData;
import blue.jfx.BlueFX;
import blue.mixer.*;
import blue.orchestra.blueSynthBuilder.BSBObjectRegistry;
import blue.orchestra.editor.blueSynthBuilder.jfx.BSBEditPane;
import blue.projects.BlueProjectManager;
import java.awt.Frame;
import java.lang.ref.WeakReference;
import java.util.List;
import java.util.Map;
import java.util.WeakHashMap;
import javafx.embed.swing.JFXPanel;
import javafx.scene.Scene;
import javax.swing.JDialog;
import javax.swing.SwingUtilities;

public class EffectEditorManager {

    private static EffectEditorManager manager = null;

    private final Map<Effect, WeakReference<JDialog>> map = new WeakHashMap<>();

    private EffectEditorManager() {
    }

    public void clear() {

        for (WeakReference<JDialog> ref : map.values()) {
            JDialog dialog = ref.get();
            if (dialog != null) {
                dialog.setVisible(false);
                dialog.dispose();
            }
        }
        map.clear();
    }

    public void removeEffect(Effect effect) {
        if (map.containsKey(effect)) {
            WeakReference<JDialog> ref = map.get(effect);

            JDialog dialog = ref.get();
            if (dialog != null) {
                dialog.setVisible(false);
                dialog.dispose();
            }

            map.remove(effect);
        }
    }

    public void openEffectEditor(Frame root, Effect effect) {
        JDialog dialog = null;

        WeakReference<JDialog> ref = map.get(effect);
        if (ref != null) {
            dialog = ref.get();
        }

        if (dialog == null) {
            dialog = new JDialog(root);

            JFXPanel panel = new JFXPanel();

            dialog.getContentPane().add(panel);

            dialog.setTitle(getChannelNameForEffect(effect) + effect.getName());

            dialog.getRootPane().putClientProperty("SeparateWindow", Boolean.TRUE);

            dialog.setVisible(true);

            final JDialog dlg = dialog;
            BlueFX.runOnFXThread(() -> {
                BSBEditPane editPanel = new BSBEditPane(BSBObjectRegistry
                        .getBSBObjects(), false);
                editPanel.editBSBGraphicInterface(effect.getGraphicInterface());

                Scene scene = new Scene(editPanel);
                BlueFX.style(scene);
                panel.setScene(scene);

                SwingUtilities.invokeLater(() -> {
                    dlg.pack();
                    dlg.setSize(dlg.getWidth() + 5, dlg.getHeight() + 5);
                });

            });

            map.put(effect, new WeakReference(dialog));
        } else {
            dialog.setVisible(true);
        }

    }

    private String getChannelNameForEffect(Effect effect) {
        BlueData data = BlueProjectManager.getInstance().getCurrentProject().getData();

        Mixer mixer = data.getMixer();

        List<Channel> channels = mixer.getAllChannels();

        for (Channel channel : channels) {
            if (channel.getPreEffects().contains(effect)
                    || channel.getPostEffects().contains(effect)) {
                return String.format("[%s] - ", channel.getName());
            }
        }
        return "";
    }

    public void updateEffectInterface(Effect effect) {

        JDialog dialog = null;
        WeakReference<JDialog> ref = map.get(effect);
        if (ref != null) {
            dialog = ref.get();
        }

        if (dialog != null) {
            final JDialog dlg = dialog;
            SwingUtilities.invokeLater(() -> {
                dlg.pack();
                dlg.setSize(dlg.getWidth() + 5, dlg.getHeight() + 5);
            });
        }
    }

    public static EffectEditorManager getInstance() {
        if (manager == null) {
            manager = new EffectEditorManager();
        }

        return manager;
    }

}
