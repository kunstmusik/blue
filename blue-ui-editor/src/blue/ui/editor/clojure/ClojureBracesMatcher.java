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

import blue.ui.editor.clojure.antlr.ClojureLexer;
import blue.ui.editor.support.OffsetRange;
import javax.swing.text.AbstractDocument;
import javax.swing.text.BadLocationException;
import org.netbeans.api.lexer.Token;
import org.netbeans.api.lexer.TokenId;
import org.netbeans.api.lexer.TokenSequence;
import org.netbeans.editor.BaseDocument;
import org.netbeans.spi.editor.bracesmatching.BracesMatcher;
import org.netbeans.spi.editor.bracesmatching.MatcherContext;

/**
 * Based heavily on UnoBracesMatcher from 
 * http://wiki.netbeans.org/Netbeans_Antlr_BracesMatching
 * 
 * @author stevenyi
 */
public class ClojureBracesMatcher implements BracesMatcher {
    private final MatcherContext context;

    private class BracePair{
        int open;       // Lexer ordinal of opening brace eg { or [
        int close;      // Lexer ordinal of closing brace eg } or }

        private BracePair(int op, int cl) {
         open = op;
         close = cl;
        }
    }
    BracePair[] bracePairs = {
        new BracePair(ClojureLexer.OPEN_PAREN, ClojureLexer.CLOSE_PAREN),
        new BracePair(ClojureLexer.LEFT_CURLY_BRACKET, ClojureLexer.RIGHT_CURLY_BRACKET),
        new BracePair(ClojureLexer.LEFT_SQUARE_BRACKET, ClojureLexer.RIGHT_SQUARE_BRACKET)
    };
    
    public ClojureBracesMatcher(MatcherContext context) {
        this.context = context;
    }
    
    @Override
    public int[] findOrigin() throws InterruptedException, BadLocationException {
        int[] ret = null;
        ((AbstractDocument) context.getDocument()).readLock();
        try {
            BaseDocument doc = (BaseDocument) context.getDocument();
            int offset = context.getSearchOffset();
            TokenSequence<?extends ClojureTokenId> ts = ClojureLexUtilities.getClojureTokenSequence(doc, offset);
            
            if (ts != null) {
                ts.move(offset);

                if (ts.moveNext()) {

                    Token<?extends ClojureTokenId> token = ts.token();

                    if (token != null) {
                        TokenId id = token.id();
                        int ordinal = id.ordinal();

                        for(BracePair bp : bracePairs)
                        {
                            if (ordinal == bp.open) {
                                ret= new int [] { ts.offset(), ts.offset() + token.length() };
                                break;
                            } else if (ordinal == bp.close) {
                                ret = new int [] { ts.offset(), ts.offset() + token.length() };
                                break;
                            }
                        }
                    }
                }
            }
            
        } finally {
            ((AbstractDocument) context.getDocument()).readUnlock();
        }
        return ret;
    }

    @Override
    public int[] findMatches() throws InterruptedException, BadLocationException {
        int[] ret = null;
        ((AbstractDocument) context.getDocument()).readLock();
        try {
            BaseDocument doc = (BaseDocument) context.getDocument();
            int offset = context.getSearchOffset();
            TokenSequence<?extends ClojureTokenId> ts = ClojureLexUtilities.getClojureTokenSequence(doc, offset);

            if (ts != null) {
                ts.move(offset);

                if (ts.moveNext()) {

                    Token<?extends ClojureTokenId> token = ts.token();

                    if (token != null) {
                        TokenId id = token.id();
                        int ordinal = id.ordinal();
                        OffsetRange r;

                        for(BracePair bp : bracePairs)
                        {
                            if (ordinal == bp.open) {
                                r = ClojureLexUtilities.findFwd(ts, bp.open, bp.close);
                                ret= new int [] {r.getStart(), r.getEnd() };
                                break;
                            } else if (ordinal == bp.close) {
                                r = ClojureLexUtilities.findBwd(ts, bp.open, bp.close);
                                ret= new int [] {r.getStart(), r.getEnd() };
                                break;

                            }
                        }
                    }
                }
            }

        } finally {
            ((AbstractDocument) context.getDocument()).readUnlock();
        }
        return ret;
    }
    
}
