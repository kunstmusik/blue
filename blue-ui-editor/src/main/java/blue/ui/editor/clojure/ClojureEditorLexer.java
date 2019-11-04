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
import org.netbeans.api.lexer.Token;
import org.netbeans.spi.lexer.Lexer;
import org.netbeans.spi.lexer.LexerRestartInfo;

/**
 *
 * @author stevenyi
 */
public class ClojureEditorLexer implements Lexer<ClojureTokenId> {

    private LexerRestartInfo<ClojureTokenId> info;
    private ClojureLexer lexer;

    public ClojureEditorLexer(LexerRestartInfo<ClojureTokenId> info) {
        this.info = info;
        AntlrCharStream charStream = new AntlrCharStream(info.input(),
                "ClojureEditor", true);
        lexer = new ClojureLexer(charStream);
    }

    @Override
    public org.netbeans.api.lexer.Token<ClojureTokenId> nextToken() {
        org.antlr.runtime.Token token = lexer.nextToken();

        Token<ClojureTokenId> createdToken = null;

        if (token.getType() != -1) {
            ClojureTokenId tokenId = ClojureLanguageHierarchy.getToken(
                    token.getType());
            createdToken = info.tokenFactory().createToken(tokenId);
        } else if (info.input().readLength() > 0) {
            ClojureTokenId tokenId = ClojureLanguageHierarchy.getToken(
                    ClojureLexer.SPACE);
            createdToken = info.tokenFactory().createToken(tokenId);
        }

        return createdToken;
    }

    @Override
    public Object state() {
        return null;
    }

    @Override
    public void release() {
    }
}
