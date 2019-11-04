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

package blue.utility;

/**
 * @author steven
 * 
 */
public class DX7Lister {

    public static void main(String[] args) {
//        StringBuffer buffer = new StringBuffer();
//        File dir = new File("/work/audio/dx7");
//        File[] dx7Files = dir.listFiles();
//        byte[] sysex;
//        String[] names;
//
//        buffer.append("<html><head><title>DX7 File List</title></head>\n");
//        buffer.append("<body>\n");
//        for (int i = 0; i < dx7Files.length; i++) {
//            buffer.append("<b>" + dx7Files[i].getAbsolutePath() + "</b><br>\n");
//            sysex = BlueX7SysexReader.fileToByteArray(dx7Files[i]);
//
//            if (BlueX7SysexReader.getSysexType(sysex) != BlueX7SysexReader.BANK) {
//                buffer
//                        .append("Not detected as bank. Skipping file.<br>\n<br>\n");
//                continue;
//            }
//            names = BlueX7SysexReader.getNameListFromBank(sysex);
//
//            for (int j = 0; j < names.length; j++) {
//                buffer.append((j + 1) + ". " + names[j] + "<br>\n");
//            }
//            buffer.append("<br>\n");
//        }
//
//        buffer.append("</body></html>");
//        System.out.println(buffer.toString());
    }
}
