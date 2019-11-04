/*
 * blue - object composition environment for csound Copyright (c) 2000-2003
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

package blue.soundObject.editor.ceciliaModule;

import blue.BlueSystem;
import blue.utility.GUI;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import javax.swing.Icon;
import javax.swing.ImageIcon;
import javax.swing.JButton;
import javax.swing.JToolBar;
import org.openide.util.ImageUtilities;

public class GrapherMenuBar extends JToolBar {

    private static String IMAGE_HOME = "blue/soundObject/editor/ceciliaModule/images/";

    Grapher grapher;

    public GrapherMenuBar() {
        this.setFloatable(false);

        JButton cut = getButton("cut.gif");
        cut.setToolTipText(BlueSystem.getString("ceciliaModule.graph.cut"));
        cut.addActionListener(new CutAction());

        JButton copy = getButton("copy.gif");
        copy.setToolTipText(BlueSystem.getString("ceciliaModule.graph.copy"));
        copy.addActionListener(new CopyAction());

        JButton paste = getButton("paste.gif");
        paste.setToolTipText(BlueSystem.getString("ceciliaModule.graph.paste"));
        paste.addActionListener(new PasteAction());

        JButton reset = getButton("reset.gif");
        reset.setToolTipText(BlueSystem.getString("ceciliaModule.graph.reset"));
        reset.addActionListener(new ResetGraphAction());

        JButton exp = getButton("exp.gif");
        exp.setToolTipText(BlueSystem.getString("ceciliaModule.graph.export"));
        exp.addActionListener(new ExportAction());

        JButton imp = getButton("imp.gif");
        imp.setToolTipText(BlueSystem.getString("ceciliaModule.graph.import"));
        imp.addActionListener(new ImportAction());

        JButton moveUp = getButton("up1.gif");
        moveUp.setToolTipText(BlueSystem
                .getString("ceciliaModule.graph.moveUpOnePixel"));
        moveUp.addActionListener(new UpOneAction());

        JButton moveDown = getButton("down1.gif");
        moveUp.setToolTipText(BlueSystem
                .getString("ceciliaModule.graph.moveDownOnePixel"));
        moveDown.addActionListener(new DownOneAction());

        JButton sine = getButton("sines.gif");
        sine.setToolTipText(BlueSystem
                .getString("ceciliaModule.graph.generateSine"));
        sine.addActionListener(new GenerateSineAction());

        JButton square = getButton("square.gif");
        square.setToolTipText(BlueSystem
                .getString("ceciliaModule.graph.generateSquare"));
        square.addActionListener(new GenerateSquareAction());

        // TODO - need to add drunk options modal window
        JButton drunk = getButton("drunks.gif");
        drunk.setToolTipText(BlueSystem
                .getString("ceciliaModule.graph.generateDrunk"));
        drunk.addActionListener(new DrunkGraphAction());

        // TODO - need to add random options modal window
        JButton random = getButton("rand.gif");
        random.setToolTipText(BlueSystem
                .getString("ceciliaModule.graph.generateRandom"));
        random.addActionListener(new RandomGraphAction());

        // TODO - need to add scatter options modal window
        JButton scatter = getButton("scatt.gif");
        scatter.setToolTipText(BlueSystem
                .getString("ceciliaModule.graph.scatter"));
        scatter.addActionListener(new ScatterGraphAction());

        this.add(cut);
        this.add(copy);
        this.add(paste);
        this.add(reset);
        this.add(exp);
        this.add(imp);

        this.addSeparator();

        this.add(moveUp);
        this.add(moveDown);

        this.addSeparator();

        this.add(sine);
        this.add(square);
        this.add(drunk);
        this.add(random);
        this.add(scatter);
    }

    public void setGrapher(Grapher grapher) {
        this.grapher = grapher;
    }

    private JButton getButton(String imageName) {
        Icon icon = new ImageIcon(ImageUtilities.loadImage(IMAGE_HOME
                + imageName));
        JButton button = new JButton(icon);
        button.setFocusPainted(false);
        return button;
    }

    public static void main(String[] args) {
        GUI.showComponentAsStandalone(new GrapherMenuBar(), "Grapher Bar Test",
                true);
    }

    // ACTIONS

    private final class ScatterGraphAction implements ActionListener {

        @Override
        public void actionPerformed(ActionEvent e) {
            // TODO Auto-generated method stub

        }
    }

    private final class RandomGraphAction implements ActionListener {

        @Override
        public void actionPerformed(ActionEvent e) {
            if (grapher != null) {
                grapher.generateRandomGraph();
            }
        }
    }

    private final static class DrunkGraphAction implements ActionListener {

        @Override
        public void actionPerformed(ActionEvent e) {
            // TODO Auto-generated method stub

        }
    }

    private final static class GenerateSquareAction implements ActionListener {

        @Override
        public void actionPerformed(ActionEvent e) {
            // TODO Auto-generated method stub

        }
    }

    private final class GenerateSineAction implements ActionListener {

        @Override
        public void actionPerformed(ActionEvent e) {
            if (grapher != null) {
                grapher.generateSineGraph();
            }
        }
    }

    private final class ResetGraphAction implements ActionListener {

        @Override
        public void actionPerformed(ActionEvent e) {
            if (grapher != null) {
                grapher.resetGraph();
            }
        }
    }

    private final class CutAction implements ActionListener {

        @Override
        public void actionPerformed(ActionEvent e) {
            if (grapher != null) {
                grapher.copyGraph();
                grapher.resetGraph();
            }
        }
    }

    private final class CopyAction implements ActionListener {

        @Override
        public void actionPerformed(ActionEvent e) {
            if (grapher != null) {
                grapher.copyGraph();
            }
        }
    }

    private final class PasteAction implements ActionListener {

        @Override
        public void actionPerformed(ActionEvent e) {
            if (grapher != null) {
                grapher.pasteGraph();
            }
        }
    }

    private final class ExportAction implements ActionListener {

        @Override
        public void actionPerformed(ActionEvent e) {
            // TODO Auto-generated method stub

        }
    }

    private final class ImportAction implements ActionListener {

        @Override
        public void actionPerformed(ActionEvent e) {
            // TODO Auto-generated method stub

        }
    }

    private final class UpOneAction implements ActionListener {

        @Override
        public void actionPerformed(ActionEvent e) {
            if (grapher != null) {
                grapher.moveUpGraph();
            }
        }
    }

    private final class DownOneAction implements ActionListener {

        @Override
        public void actionPerformed(ActionEvent e) {
            if (grapher != null) {
                grapher.moveDownGraph();
            }
        }
    }

}