/*
 * blue - object composition environment for csound
 * Copyright (C) 2016
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
package blue.orchestra.blueSynthBuilder;

import electric.xml.Element;
import electric.xml.Elements;
import java.awt.Font;

/**
 *
 * @author stevenyi
 */
public class BSBFontUtil {
   public static Element saveAsXML(Font f)  {
       Element root = new Element("font");
       root.addElement("name").setText(f.getName());
       root.addElement("size").setText(Double.toString(f.getSize()));
       root.addElement("style").setText(Integer.toString(f.getStyle()));

       return root;
   }

   public static Font loadFromXML(Element f) {
       String name = "Roboto";
       double size = 12.0f;

       Elements nodes = f.getElements();
       int style = Font.PLAIN;
       while(nodes.hasMoreElements()) {
           Element elem = nodes.next();

           switch(elem.getName()) {
               case "name":
                   name = elem.getTextString();
                   break;
               case "size":
                   size = Double.parseDouble(elem.getTextString());
                   break;
               case "style":
                   style = Integer.parseInt(elem.getTextString());
               default:
                   break;
           }
       }
       
       if("System Regular".equals(name)) {
           name = "Roboto";
       } else if("System Bold".equals(name)) {
           name = "Roboto";
           style = Font.BOLD;
       }
       
       return new Font(name, style, (int)size);
   }
   
}
