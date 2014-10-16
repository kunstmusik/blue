/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2014 Steven Yi (stevenyi@gmail.com)
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

package blue.scripting;

import electric.xml.Element;
import electric.xml.Elements;
import java.io.Serializable;

/**
 * 
 * @author steven
 */
public class Script implements Serializable {

    private String name = "New Script";

    private String description = "";

    private String code = "";

    private String comments = "";

    /** Creates a new instance of Script */
    public Script() {
        code = "#use variable blueData for current BlueData project\n"
                + "#use variable selectedSoundObjects to get array of soundObjects "
                + "selected on the timeline\n"
                + "#use variable userConfigDir for user's .blue dir\n"
                + "#use variable blueLibDir for blue's lib directory\n"
                + "#use variable blueProjectDir for this project's directory\n";

    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getComments() {
        return comments;
    }

    public void setComments(String comments) {
        this.comments = comments;
    }

    public Element saveAsXML() {
        Element retVal = new Element("script");

        retVal.addElement("name").setText(name);
        retVal.addElement("description").setText(description);
        retVal.addElement("code").setText(code);
        retVal.addElement("comments").setText(comments);

        return retVal;
    }

    public static Script loadFromXML(Element data) {
        Script script = new Script();

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();

            String nodeName = node.getName();

            if (nodeName.equals("name")) {
                script.setName(node.getTextString());
            } else if (nodeName.equals("description")) {
                script.setDescription(node.getTextString());
            } else if (nodeName.equals("code")) {
                script.setCode(node.getTextString());
            } else if (nodeName.equals("comments")) {
                script.setComments(node.getTextString());
            }
        }

        return script;
    }

    public String toString() {
        return getName();
    }
}
