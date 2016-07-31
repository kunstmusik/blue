/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2003 Steven Yi (stevenyi@gmail.com)
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

package blue.soundObject.editor.ceciliaModule;

import blue.soundObject.CeciliaModule;
import java.awt.BorderLayout;
import java.util.StringTokenizer;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.regex.PatternSyntaxException;
import javax.swing.JComponent;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JSplitPane;

public class GrapherEditPanel extends JComponent {
    GrapherLineController grapherLineController = new GrapherLineController();

    Grapher grapher = new Grapher();

    GrapherMenuBar menu = new GrapherMenuBar();

    TogglePanel toggles = new TogglePanel();

    SliderPanel sliders = new SliderPanel();

    private static Pattern labelPattern = null;

    static {
        try {
            // PatternCompiler compiler = new Perl5Compiler();
            // labelPattern = compiler.compile("label\\s\"([^\"]*)");
            labelPattern = Pattern.compile("label\\s\"([^\"]*)");
        } catch (PatternSyntaxException e) {
            e.printStackTrace();
        }
    }

    public GrapherEditPanel() {
        this.setLayout(new BorderLayout());

        JSplitPane mainJSP = new JSplitPane(JSplitPane.HORIZONTAL_SPLIT);
        JSplitPane graphJSP = new JSplitPane(JSplitPane.VERTICAL_SPLIT);
        JSplitPane sliderToggleJSP = new JSplitPane(JSplitPane.HORIZONTAL_SPLIT);

        mainJSP.add(new JScrollPane(grapherLineController), JSplitPane.LEFT);
        mainJSP.add(graphJSP, JSplitPane.RIGHT);

        JPanel graphPane = new JPanel(new BorderLayout());
        graphPane.add(menu, BorderLayout.NORTH);
        graphPane.add(new JScrollPane(grapher));

        graphJSP.add(graphPane, JSplitPane.TOP);
        graphJSP.add(sliderToggleJSP, JSplitPane.BOTTOM);

        sliderToggleJSP.add(new JScrollPane(sliders), JSplitPane.LEFT);
        sliderToggleJSP.add(new JScrollPane(toggles), JSplitPane.RIGHT);

        this.add(mainJSP, BorderLayout.CENTER);

        grapherLineController.setGrapher(grapher);
        menu.setGrapher(grapher);

        mainJSP.setDividerLocation(200);
        graphJSP.setDividerLocation(300);
        sliderToggleJSP.setDividerLocation(250);
    }

    /**
     * @param ceciliaModule
     */
    public void editCeciliaModule(CeciliaModule ceciliaModule) {
        toggles.clearToggles();
        sliders.clearSliders();
        grapherLineController.clearPanel();
        grapher.clearPanel();

        createInterfaceForModule(ceciliaModule);

        toggles.editCeciliaModule(ceciliaModule);
        sliders.editCeciliaModule(ceciliaModule);
        grapherLineController.editCeciliaModule(ceciliaModule);
        grapher.editCeciliaModule(ceciliaModule);
    }

    private void createInterfaceForModule(CeciliaModule ceciliaModule) {
        String tk_interface = ceciliaModule.getModuleDefinition().tk_interface;

        StringTokenizer st = new StringTokenizer(tk_interface, "\n");
        String line;
        while (st.hasMoreTokens()) {
            line = st.nextToken().trim();

            // System.err.println(line);

            if (line.length() == 0) {
                continue;
            }

            StringTokenizer objectTokenizer = new StringTokenizer(line);
            if (objectTokenizer.countTokens() == 0) {
                continue;
            }

            String objectType = objectTokenizer.nextToken();

            if (!objectType.equals("csepar")
                    && objectTokenizer.countTokens() == 1) {
                // show some error
                continue;
            }

            if (objectType.equals("csepar")) {
                this.grapherLineController.addSeparator();
                continue;
            }

            String objectName = objectTokenizer.nextToken();

            switch (objectType) {
                case "cfilein":
                    break;
                case "cpopup":
                    break;
                case "ctoggle":
                    toggles.addToggle(objectName);
                    break;
                case "cslider":
                    sliders.addSlider(objectName);
                    break;
                case "cgraph":
                    String label = findLabel(line);
                    if (label == null) {
                        label = objectName;
                    }   grapher.addGraphOrder(objectName);
                    this.grapherLineController.addGrapher(objectName, label);
                    break;
                default:
                    break;
            }
        }
    }

    /**
     * @param line
     * @return
     */
    private String findLabel(String line) {
        Matcher matcher = labelPattern.matcher(line);

        if (matcher.find()) {
            return matcher.group(1);
        }

        return null;
    }
}
