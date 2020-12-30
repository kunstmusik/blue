/*
 * blue - object composition environment for csound Copyright (c) 2000-2009
 * Steven Yi (stevenyi@gmail.com)
 * 
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License or (at your option) any
 * later version.
 * 
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB. If not, write to the Free
 * Software Foundation Inc., 59 Temple Place - Suite 330, Boston, MA 02111-1307
 * USA
 */
package blue.ui.core.project;

import blue.BlueData;
import blue.BlueSystem;
import blue.gui.ExceptionDialog;
import blue.projects.BlueProjectManager;
import blue.services.render.CSDRenderService;
import blue.services.render.CsdRenderResult;
import blue.ui.utilities.FileChooserManager;
import java.awt.Frame;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.io.BufferedWriter;
import java.io.File;
import java.io.FileWriter;
import java.io.PrintWriter;
import org.openide.awt.StatusDisplayer;
import org.openide.windows.WindowManager;

public final class GenerateCsdAction implements ActionListener {

    private static final String FILE_GEN = "blueMainFrame.generateCSD";

    @Override
    public void actionPerformed(ActionEvent e) {
        final Frame mainWindow = WindowManager.getDefault().getMainWindow();
        File rValue = FileChooserManager.getDefault().showSaveDialog(FILE_GEN,mainWindow);

        if (rValue != null) {

            BlueData data = BlueProjectManager.getInstance().getCurrentBlueData();

            File temp = rValue;
            if (!(temp.getName().trim().endsWith(".csd"))) {
                temp = new File(temp.getAbsolutePath() + ".csd");
            }
            try {
                try (PrintWriter out = new PrintWriter(new BufferedWriter(
                             new FileWriter(temp)))) {
                    final CsdRenderResult renderResult = CSDRenderService.getDefault().generateCSD(
                            data, data.getRenderStartTime(), data.
                            getRenderEndTime(), false, false);

                    out.print(renderResult.getCsdText());
                    out.flush();
                }

                StatusDisplayer.getDefault().setStatusText(BlueSystem.getString(
                        "message.generateScore.success") + " " + temp.getName());

            } catch (Exception ex) {
                ExceptionDialog.showExceptionDialog(mainWindow, ex);
                throw new RuntimeException("CSDRender Failed");
            }
        }
//        if (rValue == JFileChooser.CANCEL_OPTION) {
//            StatusDisplayer.getDefault().setStatusText(BlueSystem.getString(
//                    "message.actionCancelled"));
//        }
    }
}
