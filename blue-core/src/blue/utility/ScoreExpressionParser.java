/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2005 Steven Yi (stevenyi@gmail.com)
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

import blue.scripting.PythonProxy;
import de.congrace.exp4j.Calculable;
import de.congrace.exp4j.ExpressionBuilder;
import de.congrace.exp4j.UnknownFunctionException;
import de.congrace.exp4j.UnparsableExpressionException;
import java.util.logging.Level;
import java.util.logging.Logger;

public class ScoreExpressionParser {

    // TODO - should throw exception, also does not yet support @ and @@ syntax
    public static float eval(String input) {

        try {
            Calculable calc = new ExpressionBuilder(input).build();
            return (float)calc.calculate();
        } catch (UnknownFunctionException | UnparsableExpressionException ex) {
            Logger.getLogger(ScoreExpressionParser.class.getName()).log(Level.SEVERE,
                    null, ex);
            throw new RuntimeException(ex);
        }
    }

    private static String clean(String input) {
        String output = input.replaceAll("\\^", "**");

        // System.out.println(input + " : " + output);

        return output;
    }
}
