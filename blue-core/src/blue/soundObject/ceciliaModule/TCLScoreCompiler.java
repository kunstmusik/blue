/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2004 Steven Yi (stevenyi@gmail.com)
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
package blue.soundObject.ceciliaModule;

import tcl.lang.Command;
import tcl.lang.Interp;
import tcl.lang.TclDouble;
import tcl.lang.TclException;
import tcl.lang.TclNumArgsException;
import tcl.lang.TclObject;

/**
 * @author steven
 * 
 * To change the template for this generated type comment go to Window -
 * Preferences - Java - Code Generation - Code and Comments
 */
public class TCLScoreCompiler {

    public static String compile(String TCLScore) {
        Interp interp = new Interp();

        Command cmd = new Command() {
            public void cmdProc(Interp interp, TclObject[] argv)
                    throws TclException {
                if (argv.length != 2) {
                    throw new TclNumArgsException(interp, 1, argv, "num1");
                }

                double answer = findgensize(Double.parseDouble(argv[1]
                        .toString()));

                TclObject retObj = TclDouble.newInstance(answer);

                interp.setResult(retObj);
                // System.out.println("findgenSize " + argv[1].toString() + " :
                // " + answer);
            }

            private double findgensize(double num) {
                int retVal = 2;

                while (retVal < num) {
                    retVal = retVal * 2;
                }

                return retVal;
            }
        };

        interp.createCommand("findgenSize", cmd);

        String retVal = "";

        try {
            interp.eval(TCLScore);
            retVal = interp.getResult().toString();
        } catch (TclException e) {
            e.printStackTrace();
        }

        interp.dispose();
        return retVal;
    }

}
