/*
 * blue - object composition environment for csound
 * Copyright (C) 2013
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
package blue.ui.editor.clojure;

import blue.ui.editor.support.OffsetRange;
import java.util.List;
import javax.swing.text.Document;
import org.netbeans.api.lexer.Token;
import org.netbeans.api.lexer.TokenHierarchy;
import org.netbeans.api.lexer.TokenId;
import org.netbeans.api.lexer.TokenSequence;
import org.netbeans.editor.BaseDocument;

/**
 *
 * @author stevenyi
 */
class ClojureLexUtilities {

    @SuppressWarnings("unchecked")
    public static TokenSequence<ClojureTokenId> getClojureTokenSequence(Document doc, int offset) {
        TokenHierarchy<Document> th = TokenHierarchy.get(doc);
        TokenSequence<ClojureTokenId> ts = th == null ? null : th.tokenSequence(ClojureTokenId.language());

        if (ts == null) {
            // Possibly an embedding scenario such as an RHTML file
            // First try with backward bias true
            List<TokenSequence<?>> list = th.embeddedTokenSequences(offset, true);

            for (TokenSequence<?extends TokenId> t : list) {
                if (t.language() == ClojureTokenId.language()) {
                    ts = (TokenSequence<ClojureTokenId>) t;

                    break;
                }
            }

            if (ts == null) {
                list = th.embeddedTokenSequences(offset, false);

                for (TokenSequence<?extends TokenId> t : list) {
                    if (t.language() == ClojureTokenId.language()) {
                        ts =        (TokenSequence<ClojureTokenId>) t;

                        break;
                    }
                }
            }
        }

        return ts;
    }
    /** Search forwards in the token sequence until a token of type <code>down</code> is found */
    public static OffsetRange findFwd(BaseDocument doc, TokenSequence<?extends ClojureTokenId> ts, char up, char down) {
        int balance = 0;

        while (ts.moveNext()) {
            Token<?extends ClojureTokenId> token = ts.token();

            if (textEquals(token.text(), up)) {
                balance++;
            } else if (textEquals(token.text(), down)) {
                if (balance == 0) {
                    return new OffsetRange(ts.offset(), ts.offset() + token.length());
                }

                balance--;
            }
        }

        return OffsetRange.NONE;
    }
    /**
     * Search forwards in the token sequence until a matching closing token is found
     * so keeps track of nested pairs of up-down eg (()) is ignored if we're
     * searching for a )
     * @param ts the TokenSequence set to the position after an up
     * @param up the opening token eg { or [
     * @param down the closing token eg } or ]
     * @return the Range of closing token in our case 1 char
     */
    public static OffsetRange findFwd(TokenSequence<?extends ClojureTokenId> ts, int up, int down) {
        int balance = 0;

        while (ts.moveNext()) {
            Token<?extends ClojureTokenId> token = ts.token();

            if (token.id().ordinal() == up){
                balance++;
            }
            else if (token.id().ordinal() == down) {
                if (balance == 0) {
                    return new OffsetRange(ts.offset(), ts.offset() + token.length());
                }
                balance--;
            }
        }

        return OffsetRange.NONE;
    }
    /**
     * Search forwards in the token sequence until a matching closing token is found
     * so keeps track of nested pairs of up-down eg (()) is ignored if we're
     * searching for a )
     * @param ts the TokenSequence set to the position after an up
     * @param up the opening token eg { or [
     * @param down the closing token eg } or ]
     * @return the Range of closing token in our case 1 char
     */
    public static OffsetRange findBwd(TokenSequence<?extends ClojureTokenId> ts, int up, int down) {
        int balance = 0;

        while (ts.movePrevious()) {
            Token<?extends ClojureTokenId> token = ts.token();
            TokenId id = token.id();

            if (token.id().ordinal() == up) {
                if (balance == 0) {
                    return new OffsetRange(ts.offset(), ts.offset() + token.length());
                }

                balance++;
            } else if (token.id().ordinal() == down) {
                balance--;
            }
        }

        return OffsetRange.NONE;
    }
    /** Search backwards in the token sequence until a token of type <code>up</code> is found */
    public static OffsetRange findBwd(BaseDocument doc, TokenSequence<?extends ClojureTokenId> ts, char up, char down) {
        int balance = 0;

        while (ts.movePrevious()) {
            Token<?extends ClojureTokenId> token = ts.token();
            TokenId id = token.id();

            if (textEquals(token.text(), up)) {
                if (balance == 0) {
                    return new OffsetRange(ts.offset(), ts.offset() + token.length());
                }

                balance++;
            } else if (textEquals(token.text(), down)) {
                balance--;
            }
        }

        return OffsetRange.NONE;
    }
    public static boolean textEquals(CharSequence text1, char... text2) {
        int len = text1.length();
        if (len == text2.length) {
            for (int i = len - 1; i >= 0; i--) {
                if (text1.charAt(i) != text2[i]) {
                    return false;
                }
            }
            return true;
        }
        return false;
    }
}