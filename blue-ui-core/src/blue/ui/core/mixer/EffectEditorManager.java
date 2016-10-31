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

import blue.jfx.BlueFX;
import blue.mixer.*;
import blue.orchestra.blueSynthBuilder.BSBObjectRegistry;
import blue.orchestra.editor.blueSynthBuilder.jfx.BSBEditPane;
import java.awt.Frame;
import java.lang.ref.WeakReference;
import java.util.Map;
import java.util.WeakHashMap;
import java.util.concurrent.CountDownLatch;
import javafx.embed.swing.JFXPanel;
import javafx.scene.Scene;
import javax.swing.JDialog;
import javax.swing.SwingUtilities;
import org.openide.util.Exceptions;

public class EffectEditorManager {

    private static EffectEditorManager manager = null;

    private Map<Effect, WeakReference<JDialog>> map = new WeakHashMap<>();

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
            Object val = map.get(effect);

            if (val != null) {
                ((JDialog) val).setVisible(false);
                ((JDialog) val).dispose();
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
            CountDownLatch latch = new CountDownLatch(1);

            double[] dims = new double[2];

            BlueFX.runOnFXThread(() -> {
                try {
                    BSBEditPane editPanel = new BSBEditPane(BSBObjectRegistry
                            .getBSBObjects());
                    editPanel.editBSBGraphicInterface(effect.getGraphicInterface());
                    effect.getGraphicInterface().setEditEnabled(false);

                    Scene scene = new Scene(editPanel);
                    BlueFX.style(scene);
                    panel.setScene(scene);

                    System.out.println(editPanel.getChildren().get(1).getBoundsInParent());
                } finally {
                    latch.countDown();
                }
            });

            try {
                latch.await();
            } catch (InterruptedException ex) {
                Exceptions.printStackTrace(ex);
            }

            dialog.getContentPane().add(panel);
            dialog.setTitle(effect.getName());

            dialog.getRootPane().putClientProperty("SeparateWindow", Boolean.TRUE);

            dialog.setVisible(true);

            final JDialog dlg = dialog;
            SwingUtilities.invokeLater(() -> {
                dlg.pack();
                dlg.setSize(dlg.getWidth() + 5, dlg.getHeight() + 5);
            });

            map.put(effect, new WeakReference(dialog));
        } else {
            dialog.setVisible(true);
        }

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
